import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import App from './App.jsx';
import Home from './pages/Home.jsx';
import About from './pages/About.jsx';
import Data from './pages/Data.jsx';
import NotFound from './pages/NotFound.jsx';
import CrashPage from './pages/CrashPage.jsx';
import './index.css';

const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    errorElement: <CrashPage />, // render errors inside routes
    children: [
      { index: true, element: <Home /> },
      { path: 'about', element: <About /> },
      { path: 'data', element: <Data /> },
      { path: '*', element: <NotFound /> },
    ],
  },
]);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
);
