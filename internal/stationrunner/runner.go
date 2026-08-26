// Package stationrunner spawns and supervises `radio station` processes
// on the panel's behalf -- one OS process per panel-managed station,
// tracked in memory (not the DB; managed_stations only records the
// operator's desired-running intent, reconciled against this at boot).
package stationrunner

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"sync"
	"syscall"
	"time"
)

type State string

const (
	StateRunning State = "running"
	StateStopped State = "stopped"
	StateCrashed State = "crashed"
)

// TokenTTL is deliberately long: a managed station's token is re-minted
// fresh on every Start/Restart (never persisted, never written to disk --
// it only ever travels via the GORADIO_JWT env var), so this only has to
// outlast however long the process happens to run between restarts.
const TokenTTL = 8760 * time.Hour // ~1 year

// ProcessStatus is a snapshot of one managed process's state.
type ProcessStatus struct {
	State     State
	StartedAt time.Time
	StoppedAt time.Time
	ExitCode  int
	ExitError string
}

type managedProc struct {
	mu        sync.Mutex
	cmd       *exec.Cmd
	logs      *ringBuffer
	state     State
	startedAt time.Time
	stoppedAt time.Time
	exitCode  int
	exitErr   string
	done      chan struct{}
	// stopping is set by Stop before signaling, so the Wait goroutine
	// below can tell a deliberate stop from an actual crash -- radio
	// station exits 0 on a clean SIGTERM, but a process that doesn't
	// handle the signal (or is escalated to SIGKILL after the 10s grace
	// period) is reported by Wait as a signal-death error, which would
	// otherwise be indistinguishable from a real crash.
	stopping bool
}

// Runner supervises managed `radio station` processes, keyed by an
// opaque key the caller controls (the panel uses "<server_id>/<slug>").
type Runner struct {
	// BinaryPath is the `radio` executable every managed process runs
	// (station_runner.binary_path). DataDir is where each managed
	// station's generated station.yaml/station.lua live
	// (station_runner.data_dir) -- see ScriptDir.
	BinaryPath string
	DataDir    string

	mu    sync.Mutex
	procs map[string]*managedProc
}

func New(binaryPath, dataDir string) *Runner {
	return &Runner{BinaryPath: binaryPath, DataDir: dataDir, procs: make(map[string]*managedProc)}
}

// Key is the opaque identifier a managed station is tracked under, both
// in this package and by the panel's own callers (httpapi, main.go's boot
// reconciliation) -- one shared definition so nothing can drift.
func Key(serverID, slug string) string {
	return serverID + "/" + slug
}

// ConfigPath and ScriptPath are where serverID/slug's generated
// station.yaml and station.lua live, under r.ScriptDir.
func (r *Runner) ConfigPath(serverID, slug string) string {
	return filepath.Join(r.ScriptDir(serverID, slug), "station.yaml")
}

func (r *Runner) ScriptPath(serverID, slug string) string {
	return filepath.Join(r.ScriptDir(serverID, slug), "station.lua")
}

// ScriptDir is where serverID/slug's generated station.yaml and
// station.lua live under r.DataDir.
func (r *Runner) ScriptDir(serverID, slug string) string {
	return ScriptDir(r.DataDir, serverID, slug)
}

// Start spawns `<BinaryPath> station --config configPath --script
// scriptPath` with jwt injected via the GORADIO_JWT env var (never
// written to configPath -- see the station.yaml template). Returns an
// error if this key is already running.
func (r *Runner) Start(key, configPath, scriptPath, jwt string) error {
	r.mu.Lock()
	if p, ok := r.procs[key]; ok {
		p.mu.Lock()
		running := p.state == StateRunning
		p.mu.Unlock()
		if running {
			r.mu.Unlock()
			return fmt.Errorf("station %q is already running", key)
		}
	}
	r.mu.Unlock()

	logs := newRingBuffer(500)
	cmd := exec.Command(r.BinaryPath, "station", "--config", configPath, "--script", scriptPath)
	cmd.Env = append(os.Environ(), "GORADIO_JWT="+jwt)
	cmd.Stdout = logs
	cmd.Stderr = logs

	if err := cmd.Start(); err != nil {
		return fmt.Errorf("start %s: %w", r.BinaryPath, err)
	}

	p := &managedProc{
		cmd:       cmd,
		logs:      logs,
		state:     StateRunning,
		startedAt: time.Now(),
		done:      make(chan struct{}),
	}
	r.mu.Lock()
	r.procs[key] = p
	r.mu.Unlock()

	go func() {
		waitErr := cmd.Wait()
		p.mu.Lock()
		p.stoppedAt = time.Now()
		if waitErr != nil {
			p.exitErr = waitErr.Error()
			if exitErr, ok := waitErr.(*exec.ExitError); ok {
				p.exitCode = exitErr.ExitCode()
			}
		}
		switch {
		case p.stopping:
			// We asked for this, however it actually died (clean exit 0,
			// or a signal if it didn't handle SIGTERM / got escalated to
			// SIGKILL) -- not a crash.
			p.state = StateStopped
		case waitErr == nil:
			p.state = StateStopped
		default:
			p.state = StateCrashed
		}
		p.mu.Unlock()
		close(p.done)
	}()

	return nil
}

// Stop gracefully SIGTERMs the process for key, waiting up to 10s before
// escalating to SIGKILL. A no-op if key isn't currently running.
func (r *Runner) Stop(key string) error {
	r.mu.Lock()
	p, ok := r.procs[key]
	r.mu.Unlock()
	if !ok {
		return nil
	}

	p.mu.Lock()
	running := p.state == StateRunning
	proc := p.cmd.Process
	done := p.done
	if running {
		p.stopping = true
	}
	p.mu.Unlock()
	if !running {
		return nil
	}

	if err := proc.Signal(syscall.SIGTERM); err != nil {
		return fmt.Errorf("signal %q: %w", key, err)
	}

	select {
	case <-done:
	case <-time.After(10 * time.Second):
		_ = proc.Kill()
		<-done
	}
	return nil
}

// Restart stops key (if running) and starts it fresh -- callers should
// mint a new token before calling this, since Start never refreshes one
// on its own.
func (r *Runner) Restart(key, configPath, scriptPath, jwt string) error {
	if err := r.Stop(key); err != nil {
		return err
	}
	return r.Start(key, configPath, scriptPath, jwt)
}

// Status reports key's current state. The second return is false if
// nothing has ever been started for key in this Runner's lifetime.
func (r *Runner) Status(key string) (ProcessStatus, bool) {
	r.mu.Lock()
	p, ok := r.procs[key]
	r.mu.Unlock()
	if !ok {
		return ProcessStatus{}, false
	}

	p.mu.Lock()
	defer p.mu.Unlock()
	return ProcessStatus{
		State:     p.state,
		StartedAt: p.startedAt,
		StoppedAt: p.stoppedAt,
		ExitCode:  p.exitCode,
		ExitError: p.exitErr,
	}, true
}

// Logs returns a snapshot of key's most recent combined stdout/stderr
// lines, oldest first. Nil if nothing has ever been started for key.
func (r *Runner) Logs(key string) []string {
	r.mu.Lock()
	p, ok := r.procs[key]
	r.mu.Unlock()
	if !ok {
		return nil
	}
	return p.logs.Lines()
}
