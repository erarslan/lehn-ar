import { useAppStore } from "./store/useAppStore";
import Home from "./ui/Home";
import Catalog from "./ui/Catalog";
import ARView from "./ui/ARView";
import Summary from "./ui/Summary";

export default function App() {
  const screen = useAppStore((s) => s.screen);
  switch (screen) {
    case "catalog":
      return <Catalog />;
    case "ar":
      return <ARView />;
    case "summary":
      return <Summary />;
    case "home":
    default:
      return <Home />;
  }
}
