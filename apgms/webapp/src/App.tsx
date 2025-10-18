import { RouterProvider, createBrowserRouter } from 'react-router-dom';
import RootLayout from './routes/root-layout';
import DashboardRoute from './routes';
import BankLinesRoute from './routes/bank-lines';

const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />, 
    children: [
      { index: true, element: <DashboardRoute /> },
      { path: 'bank-lines', element: <BankLinesRoute /> }
    ]
  }
]);

export default function App() {
  return <RouterProvider router={router} />;
}
