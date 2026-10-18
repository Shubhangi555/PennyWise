// Thrown for problems the client can fix; routes map it to a 400 response
// (anything else falls through to the central 500 handler).
export class ClientError extends Error {}
