package stationrunner

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// fakeBinary writes a tiny shell script that stands in for `radio` --
// Runner always execs it as `<path> station --config ... --script ...`,
// which every one of these scripts ignores and just runs its own body.
func fakeBinary(t *testing.T, body string) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), "fake-radio")
	script := "#!/bin/sh\n" + body + "\n"
	if err := os.WriteFile(path, []byte(script), 0o755); err != nil {
		t.Fatalf("write fake binary: %v", err)
	}
	return path
}

func waitForState(t *testing.T, r *Runner, key string, want State, timeout time.Duration) ProcessStatus {
	t.Helper()
	deadline := time.Now().Add(timeout)
	for {
		status, ok := r.Status(key)
		if ok && status.State == want {
			return status
		}
		if time.Now().After(deadline) {
			t.Fatalf("timed out waiting for state %q, last status: %+v (found=%v)", want, status, ok)
		}
		time.Sleep(10 * time.Millisecond)
	}
}

func TestStartStopLifecycle(t *testing.T) {
	bin := fakeBinary(t, "sleep 5")
	r := New(bin, t.TempDir())

	if err := r.Start("s1", "config.yaml", "script.lua", "jwt-token"); err != nil {
		t.Fatalf("Start: %v", err)
	}

	status, ok := r.Status("s1")
	if !ok || status.State != StateRunning {
		t.Fatalf("expected running immediately after Start, got %+v (found=%v)", status, ok)
	}

	if err := r.Stop("s1"); err != nil {
		t.Fatalf("Stop: %v", err)
	}
	status, ok = r.Status("s1")
	if !ok || status.State != StateStopped {
		t.Fatalf("expected stopped after Stop, got %+v (found=%v)", status, ok)
	}
}

func TestStartAlreadyRunning(t *testing.T) {
	bin := fakeBinary(t, "sleep 5")
	r := New(bin, t.TempDir())

	if err := r.Start("s1", "config.yaml", "script.lua", "jwt"); err != nil {
		t.Fatalf("Start: %v", err)
	}
	t.Cleanup(func() { _ = r.Stop("s1") })

	if err := r.Start("s1", "config.yaml", "script.lua", "jwt"); err == nil {
		t.Fatal("expected an error starting an already-running key")
	}
}

func TestCrashRecordsExitCode(t *testing.T) {
	bin := fakeBinary(t, "exit 7")
	r := New(bin, t.TempDir())

	if err := r.Start("s1", "config.yaml", "script.lua", "jwt"); err != nil {
		t.Fatalf("Start: %v", err)
	}

	status := waitForState(t, r, "s1", StateCrashed, 2*time.Second)
	if status.ExitCode != 7 {
		t.Fatalf("expected exit code 7, got %d", status.ExitCode)
	}
}

func TestLogsCaptureCombinedOutput(t *testing.T) {
	bin := fakeBinary(t, "echo hello-stdout\necho hello-stderr 1>&2\n")
	r := New(bin, t.TempDir())

	if err := r.Start("s1", "config.yaml", "script.lua", "jwt"); err != nil {
		t.Fatalf("Start: %v", err)
	}
	waitForState(t, r, "s1", StateStopped, 2*time.Second)

	lines := r.Logs("s1")
	joined := ""
	for _, l := range lines {
		joined += l + "\n"
	}
	if !strings.Contains(joined, "hello-stdout") || !strings.Contains(joined, "hello-stderr") {
		t.Fatalf("expected both stdout and stderr lines in logs, got: %v", lines)
	}
}

func TestRestart(t *testing.T) {
	bin := fakeBinary(t, "sleep 5")
	r := New(bin, t.TempDir())

	if err := r.Start("s1", "config.yaml", "script.lua", "jwt"); err != nil {
		t.Fatalf("Start: %v", err)
	}
	first, _ := r.Status("s1")

	if err := r.Restart("s1", "config.yaml", "script.lua", "jwt"); err != nil {
		t.Fatalf("Restart: %v", err)
	}
	t.Cleanup(func() { _ = r.Stop("s1") })

	second, ok := r.Status("s1")
	if !ok || second.State != StateRunning {
		t.Fatalf("expected running after Restart, got %+v", second)
	}
	if !second.StartedAt.After(first.StartedAt) {
		t.Fatalf("expected a later StartedAt after Restart: first=%v second=%v", first.StartedAt, second.StartedAt)
	}
}

func TestStatusUnknownKey(t *testing.T) {
	r := New("irrelevant", t.TempDir())
	if _, ok := r.Status("nope"); ok {
		t.Fatal("expected ok=false for a key that was never started")
	}
	if lines := r.Logs("nope"); lines != nil {
		t.Fatalf("expected nil logs for a key that was never started, got %v", lines)
	}
}
