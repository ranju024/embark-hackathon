// Small shared helper so every page/component can check login state
// the same way, instead of each one reaching into localStorage directly.

export const isLoggedIn = () => !!localStorage.getItem("access_token");

export const logout = () => {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
};