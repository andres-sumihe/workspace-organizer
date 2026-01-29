import React from 'react';
import Markdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import remarkDeflist from 'remark-deflist';
import remarkEmoji from 'remark-emoji';
import remarkFlexibleContainers from 'remark-flexible-containers';
import remarkFlexibleMarkers from 'remark-flexible-markers';
import remarkGfm from 'remark-gfm';
import remarkIns from 'remark-ins';
import remarkMath from 'remark-math';
import remarkSupersub from 'remark-supersub';

import 'highlight.js/styles/github-dark.css';
import 'katex/dist/katex.min.css';

// Memoized markdown components configuration
export const markdownComponents = {
  h1: (props: React.ComponentProps<'h1'>) => <h1 className="text-3xl font-bold mt-6 mb-4" {...props} />,
  h2: (props: React.ComponentProps<'h2'>) => <h2 className="text-2xl font-bold mt-5 mb-3" {...props} />,
  h3: (props: React.ComponentProps<'h3'>) => <h3 className="text-xl font-bold mt-4 mb-2" {...props} />,
  h4: (props: React.ComponentProps<'h4'>) => <h4 className="text-lg font-bold mt-3 mb-2" {...props} />,
  h5: (props: React.ComponentProps<'h5'>) => <h5 className="text-base font-bold mt-2 mb-1" {...props} />,
  h6: (props: React.ComponentProps<'h6'>) => <h6 className="text-sm font-bold mt-2 mb-1" {...props} />,
  p: (props: React.ComponentProps<'p'>) => <p className="mb-4 leading-7" {...props} />,
  ul: (props: React.ComponentProps<'ul'>) => <ul className="list-disc list-inside mb-4 space-y-2" {...props} />,
  ol: (props: React.ComponentProps<'ol'>) => <ol className="list-decimal list-inside mb-4 space-y-2" {...props} />,
  li: (props: React.ComponentProps<'li'>) => <li className="leading-7" {...props} />,
  code: (props: React.ComponentProps<'code'>) => <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono" {...props} />,
  pre: (props: React.ComponentProps<'pre'>) => <pre className="bg-muted p-4 rounded-lg overflow-x-auto mb-4 font-mono text-sm" {...props} />,
  blockquote: (props: React.ComponentProps<'blockquote'>) => <blockquote className="border-l-4 border-primary pl-4 italic my-4" {...props} />,
  a: (props: React.ComponentProps<'a'>) => <a className="text-blue-500 hover:text-blue-700 underline cursor-pointer" target="_blank" rel="noopener noreferrer" {...props} />,
  table: (props: React.ComponentProps<'table'>) => <table className="w-full border-collapse my-4" {...props} />,
  thead: (props: React.ComponentProps<'thead'>) => <thead className="bg-muted" {...props} />,
  tbody: (props: React.ComponentProps<'tbody'>) => <tbody {...props} />,
  tr: (props: React.ComponentProps<'tr'>) => <tr className="border-b" {...props} />,
  th: (props: React.ComponentProps<'th'>) => <th className="border px-4 py-2 text-left font-semibold" {...props} />,
  td: (props: React.ComponentProps<'td'>) => <td className="border px-4 py-2" {...props} />,
  hr: (props: React.ComponentProps<'hr'>) => <hr className="my-8 border-border" {...props} />,
  img: (props: React.ComponentProps<'img'>) => <img className="max-w-full h-auto rounded-lg my-4" {...props} />,
  del: (props: React.ComponentProps<'del'>) => <del className="line-through opacity-60" {...props} />,
  ins: (props: React.ComponentProps<'ins'>) => <ins className="decoration-green-500 underline bg-green-100 dark:bg-green-900/30" {...props} />,
  mark: (props: React.ComponentProps<'mark'>) => <mark className="bg-yellow-200 dark:bg-yellow-900/40 px-1" {...props} />,
  sup: (props: React.ComponentProps<'sup'>) => <sup className="text-[0.75em] relative -top-[0.5em]" {...props} />,
  sub: (props: React.ComponentProps<'sub'>) => <sub className="text-[0.75em] relative top-[0.25em]" {...props} />,
  dl: (props: React.ComponentProps<'dl'>) => <dl className="my-4" {...props} />,
  dt: (props: React.ComponentProps<'dt'>) => <dt className="font-bold mt-2" {...props} />,
  dd: (props: React.ComponentProps<'dd'>) => <dd className="ml-4 mb-2 text-muted-foreground" {...props} />,
  input: (props: React.ComponentProps<'input'>) => {
    if (props.type === 'checkbox') {
      return <input className="mr-2 align-middle" {...props} />;
    }
    return <input {...props} />;
  },
};

// Memoized remark/rehype plugin arrays to prevent recreation
export const remarkPlugins: Parameters<typeof Markdown>[0]['remarkPlugins'] = [
  remarkGfm,
  remarkMath,
  remarkDeflist,
  [remarkEmoji, { emoticon: true }], // Enable emoticon conversion :-) :D <3
  remarkSupersub,           // H~2~O for subscript, x^2^ for superscript
  remarkFlexibleMarkers,    // ==highlighted text==
  remarkIns,                // ++inserted text++
  remarkFlexibleContainers, // ::: note/warning/tip containers
];
export const rehypePlugins = [rehypeRaw, rehypeHighlight, rehypeKatex];
