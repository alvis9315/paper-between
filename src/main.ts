import { createApp } from "vue";
import App from "./App.vue";
import "./style.css";
import "./theme.css";
import { initializeTheme } from "./core/theme";
initializeTheme();
createApp(App).mount("#app");
