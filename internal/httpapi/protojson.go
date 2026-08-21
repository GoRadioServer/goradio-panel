package httpapi

import (
	"net/http"

	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/proto"
)

// protoMarshaler keeps snake_case field names (matching the REST API
// table's documented shape) and renders enums as their string names
// (e.g. "QUEUE_MODE_APPEND") rather than plain encoding/json's raw ints.
var protoMarshaler = protojson.MarshalOptions{UseProtoNames: true, EmitUnpopulated: true}

func writeProtoJSON(w http.ResponseWriter, status int, msg proto.Message) {
	body, err := protoMarshaler.Marshal(msg)
	if err != nil {
		http.Error(w, "failed to encode response", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_, _ = w.Write(body)
}
