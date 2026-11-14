import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { EmojiStyle } from "emoji-picker-react";
import {
  EditorContent,
  Extension,
  useEditor,
  useEditorState,
  type JSONContent,
} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Placeholder } from "@tiptap/extensions";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { docToText, usesStyledText, type DocNode } from "../../lib/unicodeText";
import Icon, { type IconName } from "../Icon";

export type EditorValue = { doc: DocNode; text: string };

type Props = {
  /** Used when the editor first appears. To load different content, give the editor a new `key`. */
  initialContent: DocNode;
  onChange: (value: EditorValue) => void;
  placeholder?: string;
  label?: string;
  /** Extra line under the editor (for example, character counters). */
  footer?: ReactNode;
};

const TAG_RE = /(^|\s)([@#][\p{L}\p{N}_][\p{L}\p{N}_.\-]*)/gu;

/** Colours @mentions and #hashtags while you type. It only changes how they look, not the text. */
const Highlights = Extension.create({
  name: "highlights",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("highlights"),
        props: {
          decorations(state) {
            const decorations: Decoration[] = [];
            state.doc.descendants((node, pos) => {
              if (!node.isText || !node.text) return;
              for (const m of node.text.matchAll(TAG_RE)) {
                const from = pos + (m.index ?? 0) + m[1].length;
                decorations.push(
                  Decoration.inline(from, from + m[2].length, {
                    class: m[2][0] === "@" ? "hl-mention" : "hl-tag",
                  }),
                );
              }
            });
            return DecorationSet.create(state.doc, decorations);
          },
        },
      }),
    ];
  },
});

const EmojiPicker = lazy(() => import("emoji-picker-react"));

/** Shift+Enter in a bullet or numbered list starts the next item, the same as Enter. */
const ShiftEnterList = Extension.create({
  name: "shiftEnterList",
  priority: 1000,
  addKeyboardShortcuts() {
    return {
      "Shift-Enter": ({ editor: ed }) =>
        ed.isActive("listItem") ? ed.commands.splitListItem("listItem") : false,
    };
  },
});

function normalizeUrl(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  try {
    const url = new URL(
      /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`,
    );
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

const HANDLE_RE = /^@?[A-Za-z0-9_][A-Za-z0-9_.\-]{0,60}(@[A-Za-z0-9.\-]+)?$/;

function Tool(props: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={props.label}
      aria-label={props.label}
      aria-pressed={props.active}
      disabled={props.disabled}
      onMouseDown={(e) => e.preventDefault()} // keep the text selection
      onClick={props.onClick}
      className={`grid h-8 min-w-8 place-items-center rounded-lg px-1.5 text-sm transition-colors disabled:opacity-35 ${
        props.active
          ? "bg-forest-900 text-white shadow-sm"
          : "text-ink hover:bg-white"
      }`}
    >
      {props.children}
    </button>
  );
}

const Divider = () => (
  <span className="mx-0.5 hidden h-5 w-px bg-sage-200 sm:block" />
);

type Panel = "link" | "mention" | "emoji" | null;

export default function RichTextEditor({
  initialContent,
  onChange,
  placeholder = "Write your post…",
  label = "Post text",
  footer,
}: Props) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [panel, setPanel] = useState<Panel>(null);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        code: false,
        codeBlock: false,
        horizontalRule: false,
        trailingNode: false,
        link: { openOnClick: false, autolink: true, defaultProtocol: "https" },
      }),
      Placeholder.configure({ placeholder }),
      Highlights,
      ShiftEnterList,
    ],
    content: initialContent as JSONContent,
    editorProps: {
      attributes: {
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": label,
      },
    },
    onUpdate: ({ editor: ed }) => {
      const doc = ed.getJSON() as DocNode;
      onChangeRef.current({ doc, text: docToText(doc) });
    },
  });

  useEffect(() => {
    if (!editor) return;
    const doc = editor.getJSON() as DocNode;
    onChangeRef.current({ doc, text: docToText(doc) });
  }, [editor]);

  const state = useEditorState({
    editor,
    selector: ({ editor: ed }) => {
      const text = docToText(ed?.getJSON() as DocNode);
      return {
        bold: ed?.isActive("bold") ?? false,
        italic: ed?.isActive("italic") ?? false,
        underline: ed?.isActive("underline") ?? false,
        strike: ed?.isActive("strike") ?? false,
        link: ed?.isActive("link") ?? false,
        bullet: ed?.isActive("bulletList") ?? false,
        ordered: ed?.isActive("orderedList") ?? false,
        canUndo: ed?.can().undo() ?? false,
        canRedo: ed?.can().redo() ?? false,
        styled: usesStyledText(text),
        words: text.trim() ? text.trim().split(/\s+/).length : 0,
        chars: [...text].length,
      };
    },
  });

  if (!editor) return null;
  const run = () => editor.chain().focus();
  const tool = (name: IconName) => (
    <Icon name={name} className="h-[1.05rem] w-[1.05rem]" />
  );

  function open(next: Exclude<Panel, null>) {
    setError("");
    setInput(
      next === "link" ? String(editor!.getAttributes("link").href ?? "") : "",
    );
    setPanel(panel === next ? null : next);
  }

  function apply() {
    if (panel === "link") {
      const href = normalizeUrl(input);
      if (!href)
        return setError("Enter a web address that starts with http or https.");
      if (editor!.state.selection.empty && !editor!.isActive("link")) {
        run()
          .insertContent({
            type: "text",
            text: href,
            marks: [{ type: "link", attrs: { href } }],
          })
          .run();
      } else {
        run().extendMarkRange("link").setLink({ href }).run();
      }
    } else if (panel === "mention") {
      const handle = input.trim();
      if (!HANDLE_RE.test(handle))
        return setError(
          "Type the exact handle, like @buffer or @name@mastodon.social.",
        );
      run()
        .insertContent(`${handle.startsWith("@") ? handle : `@${handle}`} `)
        .run();
    }
    setPanel(null);
  }

  return (
    <div className="overflow-hidden rounded-[1.25rem] border border-line bg-paper shadow-sm transition-shadow focus-within:border-forest-600 focus-within:shadow-[0_0_0_3px_rgba(23,38,29,0.12)]">
      <div
        role="toolbar"
        aria-label="Text formatting"
        className="sticky top-0 z-10 flex flex-wrap items-center gap-0.5 border-b border-line bg-sage-50 px-2 py-2"
      >
        <Tool
          label="Bold (Ctrl+B)"
          active={state.bold}
          onClick={() => run().toggleBold().run()}
        >
          <span className="font-bold">B</span>
        </Tool>
        <Tool
          label="Italic (Ctrl+I)"
          active={state.italic}
          onClick={() => run().toggleItalic().run()}
        >
          <span className="font-serif italic">I</span>
        </Tool>
        <Tool
          label="Underline (Ctrl+U)"
          active={state.underline}
          onClick={() => run().toggleUnderline().run()}
        >
          <span className="underline">U</span>
        </Tool>
        <Tool
          label="Strikethrough"
          active={state.strike}
          onClick={() => run().toggleStrike().run()}
        >
          <span className="line-through">S</span>
        </Tool>
        <Divider />
        <Tool
          label="Add link"
          active={state.link || panel === "link"}
          onClick={() => open("link")}
        >
          {tool("link")}
        </Tool>
        <Tool
          label="Mention someone"
          active={panel === "mention"}
          onClick={() => open("mention")}
        >
          {tool("at")}
        </Tool>
        <Tool
          label="Emoji"
          active={panel === "emoji"}
          onClick={() => open("emoji")}
        >
          <span aria-hidden>🙂</span>
        </Tool>
        <Divider />
        <Tool
          label="Bulleted list"
          active={state.bullet}
          onClick={() => run().toggleBulletList().run()}
        >
          {tool("list")}
        </Tool>
        <Tool
          label="Numbered list"
          active={state.ordered}
          onClick={() => run().toggleOrderedList().run()}
        >
          {tool("olist")}
        </Tool>
        <Divider />
        <Tool
          label="Clear formatting"
          onClick={() => run().unsetAllMarks().run()}
        >
          <span className="text-xs font-semibold">Tx</span>
        </Tool>
        <Tool
          label="Undo"
          disabled={!state.canUndo}
          onClick={() => run().undo().run()}
        >
          {tool("undo")}
        </Tool>
        <Tool
          label="Redo"
          disabled={!state.canRedo}
          onClick={() => run().redo().run()}
        >
          {tool("redo")}
        </Tool>
      </div>

      {(panel === "link" || panel === "mention") && (
        <form
          className="flex flex-wrap items-center gap-2 border-b border-line bg-mist-100 px-3 py-2.5"
          onSubmit={(e) => {
            e.preventDefault();
            apply();
          }}
        >
          <input
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={panel === "link" ? "https://example.com" : "@handle"}
            aria-label={panel === "link" ? "Link address" : "Handle to mention"}
            className="min-w-0 flex-1 rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-forest-600"
          />
          <button type="submit" className="btn btn-primary btn-sm">
            {panel === "link" ? "Apply" : "Insert"}
          </button>
          {panel === "link" && state.link && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                run().extendMarkRange("link").unsetLink().run();
                setPanel(null);
              }}
            >
              Remove link
            </button>
          )}
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setPanel(null)}
          >
            Cancel
          </button>
          {error && <p className="w-full text-xs text-red-700">{error}</p>}
          {panel === "mention" && !error && (
            <p className="w-full text-xs text-muted">
              Type the exact handle. It becomes a link after publishing on X,
              Instagram, Threads, Bluesky, TikTok and Mastodon. LinkedIn
              profiles and Substack do not support mentions through Buffer.
            </p>
          )}
        </form>
      )}

      {panel === "emoji" && (
        <div
          className="border-b border-line bg-mist-100 p-2"
          onMouseDown={(e) => e.preventDefault()}
        >
          <Suspense
            fallback={<p className="p-3 text-sm text-muted">Loading emoji…</p>}
          >
            <EmojiPicker
              width="100%"
              height={340}
              emojiStyle={"native" as EmojiStyle}
              lazyLoadEmojis
              previewConfig={{ showPreview: false }}
              searchPlaceholder="Search emoji"
              onEmojiClick={(e) => run().insertContent(e.emoji).run()}
            />
          </Suspense>
        </div>
      )}

      <EditorContent editor={editor} className="editor-surface" />

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-line bg-cream px-4 py-2 text-xs text-muted">
        <span>
          {state.words} words · {state.chars} characters
        </span>
        {state.styled && (
          <span className="text-forest-700">
            Styled text uses special characters
          </span>
        )}
      </div>
      {/* {state.styled && (
        <p className="border-t border-line bg-sand-100 px-4 py-2 text-xs leading-5 text-sand-700">
          Networks only take plain text, so bold, italic, underline and strikethrough are swapped for look-alike characters. Screen readers read them oddly and search cannot find them, so use them for emphasis, not whole posts.
        </p>
      )} */}
      {footer && <div className="border-t border-line px-4 py-3">{footer}</div>}
    </div>
  );
}
