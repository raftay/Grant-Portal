import { Component, startTransition, useEffect, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import "../src/app/globals.css";
import { PaperLoader } from "@/components/paper-loader";
import { Button } from "@/components/ui/button";
import { open, runAs } from "./database";
import { render } from "./routes";
import { navigate, Path, Redirect } from "./shims/navigation";

document.documentElement.style.setProperty("--font-inter", "Inter, system-ui, sans-serif");

document.addEventListener("submit", (event) => {
  const form = event.target as HTMLFormElement;
  const action = form.getAttribute("action");
  if (!action?.startsWith("/")) return;
  event.preventDefault();
  const query = new URLSearchParams(new FormData(form) as unknown as Record<string, string>).toString();
  navigate(`${action}?${query}`);
});

const address = () => (location.hash.length > 1 ? location.hash.slice(1) : "/");

function Problem({ message }: { message: string }) {
  return (
    <main className="grid min-h-dvh place-items-center px-6">
      <div role="alert" className="max-w-md text-center">
        <h1 className="text-[22px] font-semibold">Something went wrong</h1>
        <p className="mt-2 text-muted-foreground">{message}</p>
        <Button className="mt-5" onClick={() => location.reload()}>Reload this page</Button>
      </div>
    </main>
  );
}

class Boundary extends Component<{ children: ReactNode }, { message: string }> {
  override state = { message: "" };
  static getDerivedStateFromError(error: Error) {
    return { message: error.message };
  }
  override render() {
    return this.state.message ? <Problem message={this.state.message} /> : this.props.children;
  }
}

const Loading = ({ label }: { label: string }) => (
  <div className="grid min-h-dvh place-items-center">
    <PaperLoader size="lg" label={label} />
  </div>
);

type View = { path: string; content: ReactNode };

function Demo() {
  const [view, setView] = useState<View>();
  const [problem, setProblem] = useState("");
  useEffect(() => {
    let latest = 0;
    let shown = "";
    const show = async () => {
      latest += 1;
      const turn = latest;
      const target = address();
      const path = new URL(target, location.origin).pathname;
      try {
        const content = await render(target);
        if (turn !== latest) return;
        startTransition(() => setView({ path, content }));
        if (shown !== path) window.scrollTo(0, 0);
        shown = path;
      } catch (error) {
        if (turn !== latest) return;
        if (error instanceof Redirect) navigate(error.to);
        else setProblem((error as Error).message);
      }
    };
    void open().then(show, (error: Error) => setProblem(error.message));
    window.addEventListener("hashchange", show);
    window.addEventListener("demo:refresh", show);
    return () => {
      window.removeEventListener("hashchange", show);
      window.removeEventListener("demo:refresh", show);
    };
  }, []);
  if (problem) return <Problem message={problem} />;
  if (!view) return <Loading label="Building your demo database" />;
  return (
    <Path value={view.path}>
      <Boundary>{view.content}</Boundary>
    </Path>
  );
}

Object.assign(window, { demoAs: runAs });

const root = document.getElementById("root");
if (!root) throw new Error("The page has no root");
createRoot(root).render(<Demo />);
