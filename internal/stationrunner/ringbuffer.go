package stationrunner

import (
	"bytes"
	"sync"
)

// ringBuffer is an io.Writer that keeps the last maxLines complete lines
// written to it -- used as a managed process's combined stdout/stderr
// sink, so a crash's final Lua error is visible without keeping the
// entire process lifetime's output in memory.
type ringBuffer struct {
	mu       sync.Mutex
	maxLines int
	lines    []string
	partial  []byte
}

func newRingBuffer(maxLines int) *ringBuffer {
	return &ringBuffer{maxLines: maxLines}
}

func (b *ringBuffer) Write(p []byte) (int, error) {
	b.mu.Lock()
	defer b.mu.Unlock()

	b.partial = append(b.partial, p...)
	for {
		i := bytes.IndexByte(b.partial, '\n')
		if i < 0 {
			break
		}
		line := string(bytes.TrimRight(b.partial[:i], "\r"))
		b.lines = append(b.lines, line)
		if len(b.lines) > b.maxLines {
			b.lines = b.lines[len(b.lines)-b.maxLines:]
		}
		b.partial = b.partial[i+1:]
	}
	return len(p), nil
}

// Lines returns a snapshot of the buffered lines, oldest first.
func (b *ringBuffer) Lines() []string {
	b.mu.Lock()
	defer b.mu.Unlock()
	out := make([]string, len(b.lines))
	copy(out, b.lines)
	return out
}
