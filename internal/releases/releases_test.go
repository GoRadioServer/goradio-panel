package releases

import "testing"

func TestUpdateAvailable(t *testing.T) {
	tests := []struct {
		name    string
		current string
		latest  string
		want    bool
	}{
		{"same version", "v0.11.1", "v0.11.1", false},
		{"patch behind", "v0.11.0", "v0.11.1", true},
		{"minor behind", "v0.10.5", "v0.11.0", true},
		{"major behind", "v0.11.1", "v1.0.0", true},
		{"ahead of release", "v0.12.0", "v0.11.1", false},
		{"no v prefix", "0.11.0", "0.11.1", true},
		{"mixed prefix", "v0.11.0", "0.11.1", true},
		{"short current", "v1", "v1.0.1", true},
		{"minor beats patch", "v0.9.9", "v0.10.0", true},

		// Anything unparseable must not claim an update is available.
		{"dev build", "dev", "v0.11.1", false},
		{"empty current", "", "v0.11.1", false},
		{"empty latest", "v0.11.1", "", false},
		{"garbage current", "not-a-version", "v0.11.1", false},
		{"too many parts", "v1.2.3.4", "v1.2.4", false},

		// Suffixes are trimmed, so the numeric part decides.
		{"prerelease current behind", "v0.11.0-rc1", "v0.11.1", true},
		{"prerelease same numbers", "v0.11.1-rc1", "v0.11.1", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := UpdateAvailable(tt.current, tt.latest); got != tt.want {
				t.Errorf("UpdateAvailable(%q, %q) = %v, want %v", tt.current, tt.latest, got, tt.want)
			}
		})
	}
}

func TestParseVersion(t *testing.T) {
	if got, ok := parseVersion("v1.2.3"); !ok || got != [3]int{1, 2, 3} {
		t.Errorf("parseVersion(v1.2.3) = %v, %v", got, ok)
	}
	if got, ok := parseVersion("v2"); !ok || got != [3]int{2, 0, 0} {
		t.Errorf("parseVersion(v2) = %v, %v", got, ok)
	}
	if _, ok := parseVersion("dev"); ok {
		t.Error("parseVersion(dev) should not parse")
	}
	if _, ok := parseVersion("v-1.0.0"); ok {
		t.Error("parseVersion(v-1.0.0) should not parse")
	}
}
