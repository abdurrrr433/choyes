import { createRouter, createWebHistory } from 'vue-router';
import store from '../store/index.js';
import testCenterRoutes from '../app/testCenter/routes/index.js';

// Minimal app router that wires in the test-center routes and a global auth guard.
const routes = [
  // Add other app routes here if needed
  ...testCenterRoutes,
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

// Global auth guard: redirect to /access/login when route requires auth
router.beforeEach((to, from, next) => {
  if (to.meta && to.meta.auth) {
    const isAuth = typeof store.getters?.isAuthenticated === 'function' ? store.getters.isAuthenticated() : !!store.getters?.isAuthenticated;
    if (!isAuth) return next({ path: '/access/login' });
  }
  next();
});

export default router;
export { routes };
