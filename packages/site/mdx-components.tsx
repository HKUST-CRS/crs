import type { MDXComponents } from "mdx/types";
import Link from "next/link";

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    h1: (props) => (
      <h1 className="text-4xl font-bold tracking-tight mb-8" {...props} />
    ),
    h2: (props) => (
      <h2 className="text-2xl font-semibold mt-12 mb-4 border-b border-border pb-2" {...props} />
    ),
    h3: (props) => (
      <h3 className="text-xl font-semibold mt-8 mb-3" {...props} />
    ),

    p: (props) => (
      <p className="leading-7 mb-5 text-muted-foreground" {...props} />
    ),

    a: ({ href, children, ...props }) => {
      const isExternal = href?.startsWith("http");
      if (isExternal) {
        return (
          <a
            href={href}
            className="text-primary underline underline-offset-4 hover:opacity-80"
            target="_blank"
            rel="noopener noreferrer"
            {...props}
          >
            {children}
          </a>
        );
      }
      return (
        <Link
          href={href || "#"}
          className="text-primary underline underline-offset-4 hover:opacity-80"
          {...props}
        >
          {children}
        </Link>
      );
    },

    ul: (props) => <ul className="list-disc pl-6 mb-5 space-y-2" {...props} />,
    ol: (props) => <ol className="list-decimal pl-6 mb-5 space-y-2" {...props} />,
    li: (props) => <li className="leading-7" {...props} />,

    hr: () => <hr className="my-10 border-border" />,

    pre: (props) => (
      <pre className="rounded-lg bg-muted/50 p-4 overflow-x-auto mb-6 text-sm leading-relaxed whitespace-pre-wrap" {...props} />
    ),
    code: (props) => (
      <code className="font-mono text-sm" {...props} />
    ),

    strong: (props) => <strong className="font-semibold text-foreground" {...props} />,

    ...components,
  };
}