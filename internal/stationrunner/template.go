package stationrunner

import (
	"fmt"
	"path/filepath"
	"strings"
)

// ScriptDir is where one managed station's generated station.yaml and
// station.lua live, under station_runner.data_dir.
func ScriptDir(dataDir, serverID, slug string) string {
	return filepath.Join(dataDir, serverID, slug)
}

// ConfigTemplate is a managed station's station.yaml. Deliberately
// carries no auth.jwt -- the token travels only via the GORADIO_JWT env
// var Runner.Start sets, never written to disk.
func ConfigTemplate(grpcAddr string) string {
	return fmt.Sprintf(`server:
  grpc_addr: %s

logging:
  level: "info"
`, yamlString(grpcAddr))
}

// ScriptTemplate is a freshly created station's starter station.lua --
// the goradio/scripts/release-assets/station.lua shape, with the given
// slug/name/description/logoURL baked directly into the radio.register()
// call rather than read from radio.args, so the script is self-contained
// regardless of how it's invoked. Plays silence (empty playlist) until
// edited, matching the upstream reference example's own behavior.
func ScriptTemplate(slug, name, description, logoURL string) string {
	options := ""
	if logoURL != "" {
		options = fmt.Sprintf(", { logo_url = %s }", luaString(logoURL))
	}
	return fmt.Sprintf(`-- %s: created via goradio-panel.
--
-- Edit this script from the station's Controller section in the panel,
-- then click Restart to apply changes. Full Lua API docs:
-- https://goradioserver.github.io/goradio/lua-api/

local info = radio.register(%s, %s, %s%s)
print(string.format("registered '%%s' -> %%s", info.slug, info.stream_url))

local playlist = {
  -- "jingle.mp3",
  -- "songs/track1.mp3",
  -- "https://example.com/track2.mp3",
}

radio.on_track_started(function(track)
  print(string.format("now playing: %%s", track.location))
end)

radio.on_error(function(err)
  print(string.format("error: %%s (%%s)", err.message, err.code))
end)

if #playlist == 0 then
  print("playlist is empty -- edit this script and add some tracks; playing silence until then")
else
  math.randomseed(os.time())
  radio.every(180, function()
    local pick = playlist[math.random(#playlist)]
    radio.queue(pick, "APPEND")
  end)
end
`, name, luaString(slug), luaString(name), luaString(description), options)
}

// luaString renders s as a double-quoted Lua string literal, escaping
// backslashes, quotes and newlines -- every value baked into
// ScriptTemplate is operator-supplied (slug/name/description/logoURL from
// the create-station form), so this has to be safe against quotes or
// backslashes in there, not just typical values.
func luaString(s string) string {
	var b strings.Builder
	b.WriteByte('"')
	for _, r := range s {
		switch r {
		case '"':
			b.WriteString(`\"`)
		case '\\':
			b.WriteString(`\\`)
		case '\n':
			b.WriteString(`\n`)
		case '\r':
			b.WriteString(`\r`)
		default:
			b.WriteRune(r)
		}
	}
	b.WriteByte('"')
	return b.String()
}

// yamlString quotes a value for a YAML flow scalar the same way --
// grpc_addr is operator config, not free-form user input, but quoting it
// avoids any YAML special-character surprises (a bare URL's "//" is fine
// unquoted, but this is cheap insurance).
func yamlString(s string) string {
	return fmt.Sprintf("%q", s)
}
