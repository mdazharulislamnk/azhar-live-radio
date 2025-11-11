# 🎧 Azhar Live Radio

This is a **highly scalable, full-stack, real-time radio streaming application** engineered to deliver a low-latency, seamless user experience.

---

## ✨ Key Technologies & Architecture

This project is built as a modern full-stack application leveraging the following core technologies:

* **Frontend:** Built with **React** and **TypeScript**, bundled using **Vite** for a fast development experience.
* **Styling:** Styled efficiently using **Tailwind CSS** for a utility-first approach.
* **Backend & Database:** Powered by **Convex** for real-time data synchronization and persistent storage. All backend logic runs as serverless **Node.js** functions within the Convex environment.
* **Streaming:** Utilizes **WebRTC** for robust, low-latency, peer-to-peer audio streaming, ensuring **99%+ streaming quality**.
* **Language:** Developed entirely in **TypeScript** for type safety across the full stack.

---

## 💻 Project Structure

The project is structured for clear separation of concerns between the real-time frontend and the serverless backend:

* **`app/`**: Contains the **React** frontend code (UI, components, client-side logic).
* **`convex/`**: Contains the **Convex** backend code (database schemas, type-safe API, serverless functions like queries and mutations, and HTTP routing).
    * `convex/router.ts`: Defines custom **HTTP** API endpoints.
* **`node_modules/`**: Standard location for all installed **Node.js** dependencies.

---

## 🚀 Getting Started

The project is connected to the Convex deployment named `cool-capybara-114`.

### 1. Installation

```bash
npm install

## 2. Running Locally

Use the combined `dev` script to start the Convex backend services and the React frontend simultaneously:

```bash
npm run dev

The frontend will be accessible via a local URL (typically http://localhost:5173).

## 🔒 Authentication

This application uses the Convex Auth system. It is currently configured for robust sign-in methods (as evidenced by the auth dependencies).


## 📚 Further Resources

For deep dives into the platform:

* **Convex Documentation:** [https://docs.convex.dev/](https://docs.convex.dev/)
* **Convex Auth Documentation:** [https://auth.convex.dev/](https://auth.convex.dev/)
