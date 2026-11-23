import "server-only";
// The current time, for server components. Next must not freeze "now" into a prerendered page, so call this
// only after something that waits for a real request (requireProfile / getCurrentUser call connection()).
// It lives here, not inline, so the one place that reads the clock during render is easy to find.
export const requestTime = () => Date.now();
