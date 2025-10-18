import { Route as RootRoute } from './routes/__root';
import { Route as DashboardRoute } from './routes/index';
import { Route as BankLinesRoute } from './routes/bank-lines';

export const routeTree = RootRoute.addChildren([DashboardRoute, BankLinesRoute]);
