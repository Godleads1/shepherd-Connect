import { setAuthTokenGetter } from "@workspace/api-client-react";

// Initialize the token getter before any requests are made
setAuthTokenGetter(() => localStorage.getItem("token"));
