import { createFileRoute } from "@tanstack/react-router";
import { TwiceApp } from "@/components/twice-app";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <TwiceApp />;
}
