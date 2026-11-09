// Many timestamp columns are `timestamp without time zone`, and the code that
// computes Lagos (WAT) service times adds the +1h offset itself. Both assume
// the Node process runs in UTC. If the host's TZ were Africa/Lagos, expiry
// checks (pickup codes, OTPs) would be off by an hour. Pin it here; this module
// must be the first import of the entry point.
process.env.TZ = "UTC";

export {};
