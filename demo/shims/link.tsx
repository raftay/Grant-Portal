import type { ComponentProps } from "react";

type Props = Omit<ComponentProps<"a">, "href"> & { href: string; scroll?: boolean };

export default function Link({ href, scroll, ...props }: Props) {
  return <a href={`#${href}`} data-keep-scroll={scroll === false ? "true" : undefined} {...props} />;
}
