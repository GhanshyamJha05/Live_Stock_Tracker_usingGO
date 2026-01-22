# Multi-stage Dockerfile for Stock Tracker

# Stage 1: Build the Go application
FROM golang:1.21-alpine AS builder

WORKDIR /app

# Install required packages
RUN apk add --no-cache git

# Copy Go module files
COPY backend/go.mod backend/go.sum* ./

# Download dependencies
RUN go mod download

# Copy source code
COPY backend/ .

# Build the application
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o main .

# Stage 2: Create the final image
FROM alpine:latest

WORKDIR /root/

# Install ca-certificates for HTTPS
RUN apk --no-cache add ca-certificates

# Copy the binary from builder
COPY --from=builder /app/main .

# Copy frontend files
COPY frontend ./frontend

# Expose port
EXPOSE 8080

# Set environment variables
ENV PORT=8080
ENV ENV=production
ENV API_PROVIDER=mock

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/api/health || exit 1

# Run the application
CMD ["./main"]
