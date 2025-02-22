import { createRouter, createWebHistory } from 'vue-router';
import POSOverviewView from '@/views/PointOfSale/POSOverviewView.vue';
import POSInfoView from '@/views/PointOfSale/POSInfoView.vue';
import POSCreateView from '@/views/PointOfSale/POSCreateView.vue';
import POSEditView from '@/views/PointOfSale/POSEditView.vue';
import PublicLayout from "@/layout/PublicLayout.vue";
import DashboardLayout from "@/layout/DashboardLayout.vue";
import HomeView from '@/views/HomeView.vue';
import LoginView from "@/views/LoginView.vue";
import UserOverView from '@/views/UserOverView.vue';
import SingleUserView from "@/views/SingleUserView.vue";
import BannersView from "@/views/BannersView.vue";
import ProductsContainersView from "@/views/ProductsContainersView.vue";
import { isAuthenticated, useAuthStore } from "@sudosos/sudosos-frontend-common";
import PasswordResetView from "@/views/PasswordResetView.vue";
import TransactionsView from "@/views/TransactionsView.vue";
import TermsOfServiceView from "@/views/TermsOfServiceView.vue";
import { UserRole } from '@/utils/rbacUtils';
import 'vue-router';
import ErrorView from "@/views/ErrorView.vue";
import ProfileView from "@/views/ProfileView.vue";
import FineView from "@/views/FineView.vue";
import LocalLoginView from "@/views/LocalLoginView.vue";
import LoginLayout from "@/layout/LoginLayout.vue";

declare module 'vue-router' {
  interface RouteMeta {
    // must be declared by every route
    requiresAuth: boolean

    // Board
    isBoard?: boolean,

    // Seller
    isSeller?: boolean,

    // BAC
    isBAC?: boolean,
  }
}

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '',
      component: PublicLayout,
      children: [
        {
          path: '',
          component: LoginLayout,
          children: [
            {
              path: '',
              component: LoginView,
              name: 'login',
              alias: ['/login'],
            },
            {
              path: '/local',
              component: LocalLoginView,
              name: 'local',
              alias: ['/local'],
            },
            {
              path: '/passwordreset',
              component: PasswordResetView,
              name: 'passwordreset'
            },
          ],
        },
        {
          path: '/error',
          component: ErrorView,
          name: 'error',
        },
      ]
    },
    {
      path: '',
      component: PublicLayout,
      meta: { requiresAuth: true },
      children: [{
        path: '/',
        component: TermsOfServiceView,
        name: 'tos'
      }]
    },
    {
      path: '',
      component: DashboardLayout,
      meta: { requiresAuth: true },
      children: [
        {
          path: '/',
          component: HomeView,
          name: 'home'
        },
        {
          path: '/point-of-sale/overview',
          name: 'pointOfSale',
          component: POSOverviewView,
          meta: { requiresAuth: true, isSeller: true }
        },
        {
          path: '/point-of-sale/info/:id',
          name: 'pointOfSaleInfo',
          component: POSInfoView,
          props: true,
          meta: { requiresAuth: true, isSeller: true }
        },
        {
          path: '/point-of-sale/request',
          name: 'pointOfSaleCreate',
          component: POSCreateView,
          meta: { requiresAuth: true, isSeller: true }
        },
        {
          path: '/point-of-sale/edit/:id',
          name: 'pointOfSaleEdit',
          component: POSEditView,
          props: true,
          meta: { requiresAuth: true, isSeller: true }
        },
        {
          path: '/user-overview',
          name: 'userOverview',
          component: UserOverView,
          meta: { requiresAuth: true, isBAC: true, isBoard: true }
        },
        {
          path: '/user/:userId',
          component: SingleUserView,
          name: 'user',
          props: true,
        },
        {
          path: '/manage-products',
          component: ProductsContainersView,
          name: 'products-containers-overview',
          meta: { requiresAuth: true, isBAC: true }
        },
        {
          path: '/transactions',
          component: TransactionsView,
          name: 'transaction-view'
        },
        {
          path: '/error',
          component: ErrorView,
          name: 'error',
        },
        {
          path: '/profile',
          component: ProfileView,
          name: 'profile',
        },
        {
          path: '/fine',
          component: FineView,
          name: 'fine',
          meta: { requiresAuth: true, isBAC: true }
        },
        {
          path: '/banners',
          component: BannersView,
          name: 'banners',
          meta: { requiresAuth: true, isBoard: true }
        },
        // Add other routes for authenticated users here
      ]
    }
  ]
});

router.beforeEach((to, from, next) => {
  const authStore = useAuthStore();

  const isBoard = () => {
    return authStore.roles.includes(UserRole.BOARD);
  };

  const isBAC = () => {
    return authStore.roles.includes(UserRole.BAC);
  };

  const isSeller = () => {
    return authStore.roles.includes(UserRole.SELLER);
  };

  const hasTOSAccepted = () => {
    return authStore.acceptedToS || authStore.user?.acceptedToS;
  };

  const isAuth = isAuthenticated();

  if (to.meta?.requiresAuth && !isAuth) {
    // If the route requires authentication and the user is not authenticated, redirect to login
    next({ name: 'login' });
  } else if (isAuth && hasTOSAccepted() == 'NOT_ACCEPTED' && to.name !== 'tos') {
    // If the user is authenticated but user hasn't accepted the TOS, always redirect to TOS
    next({ name: 'tos' });
  } else if (!to.meta?.requiresAuth && isAuth && hasTOSAccepted() == 'ACCEPTED') {
    // If the route doesn't require authentication and the user is authenticated, redirect to home
    next({ name: 'home' });
  } else {
    if(to.meta?.isBoard && !isBoard()) next({ name: 'home' });

    if(to.meta?.isSeller && !isSeller()) next({ name: 'home' });

    if(to.meta?.isBAC && !isBAC()) next({ name: 'home' });
    
    next();
  }
});

export default router;
