# React + Vite

## OTP Login Setup

1. Configure backend environment in `backend/.env`:

	```env
	MONGO_URI=mongodb://127.0.0.1:27017/zepto
	EMAIL_USER=your-real-gmail@gmail.com
	EMAIL_PASS=your-gmail-app-password
	CLIENT_ORIGIN=http://localhost:5173
	PORT=5000
	```

2. For Gmail, enable 2-step verification and generate an **App Password**.
3. Install and run backend:

	```bash
	cd backend
	npm install
	npm run dev
	```

4. In a second terminal, run frontend:

	```bash
	npm install
	npm run dev
	```

5. Optional frontend API override (`.env` in project root):

	```env
	VITE_API_BASE_URL=http://localhost:5000/api/auth
	```

Flow: open `/login`, enter email, click **Continue**, then enter the 6-digit OTP sent to your Gmail inbox.

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
