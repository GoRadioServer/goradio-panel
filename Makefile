.PHONY: build docker-build proto web web-build test vet fmt tidy

build:
	go build -o bin/panel ./cmd/panel

# Single-container image: API + built SPA on one port. See the
# Dockerfile's own header comment for the env vars it needs to run.
docker-build:
	docker build -t goradio-panel .

# Regenerate gen/go/audioserver/v1 from the Buf Schema Registry -- this
# repo has no local .proto files, it consumes gta-radio-golang's published
# schema at proto.prod.wtf/goradioserver/goradio.
proto:
	buf generate proto.prod.wtf/goradioserver/goradio

web:
	cd web && npm install && npm run dev

web-build:
	cd web && npm install && npm run build

test:
	go test ./...

vet:
	go vet ./...

fmt:
	gofmt -l .

tidy:
	go mod tidy
