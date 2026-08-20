import type { MDXComponents } from "mdx/types";
import Link from "next/link";

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    h1: (props) => (
      <h1 className="mb-8 font-bold text-4xl tracking-tight" {...props} />
    ),
    h2: (props) => (
      <h2
        className="mt-12 mb-4 border-border border-b pb-2 font-semibold text-2xl"
        {...props}
      />
    ),
    h3: (props) => (
      <h3 className="mt-8 mb-3 font-semibold text-xl" {...props} />
    ),

    p: (props) => (
      <p className="mb-5 text-muted-foreground leading-7" {...props} />
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

    ul: (props) => <ul className="mb-5 list-disc space-y-2 pl-6" {...props} />,
    ol: (props) => (
      <ol className="mb-5 list-decimal space-y-2 pl-6" {...props} />
    ),
    li: (props) => <li className="leading-7" {...props} />,

    hr: () => <hr className="my-10 border-border" />,

    pre: (props) => (
      <pre
        className="mb-6 overflow-x-auto whitespace-pre-wrap rounded-lg bg-muted/50 p-4 text-sm leading-relaxed"
        {...props}
      />
    ),
    code: (props) => <code className="font-mono text-sm" {...props} />,

    strong: (props) => (
      <strong className="font-semibold text-foreground" {...props} />
    ),

    ...components,
  };
}
