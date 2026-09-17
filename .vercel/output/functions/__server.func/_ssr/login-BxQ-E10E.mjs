//#region node_modules/.nitro/vite/services/ssr/assets/login-BxQ-E10E.js
function isLoginRequired(result) {
	return result.ok === false && result.loginRequired === true;
}
function isConnectorPending(result) {
	return result.ok === false && result.pending === true;
}
function isFramed() {
	try {
		return window.self !== window.top;
	} catch {
		return true;
	}
}
function redirectToLoginIfRequired(result) {
	if (!isLoginRequired(result)) return false;
	const url = result.loginUrl;
	if (!url) return false;
	if (typeof window === "undefined") return false;
	if (isFramed()) {
		const opened = window.open(url, "_blank");
		if (opened) {
			opened.opener = null;
			return true;
		}
	}
	window.location.assign(url);
	return true;
}
//#endregion
export { redirectToLoginIfRequired as i, isFramed as n, isLoginRequired as r, isConnectorPending as t };
