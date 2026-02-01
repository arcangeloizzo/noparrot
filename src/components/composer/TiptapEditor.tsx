import { useEditor, EditorContent, ReactRenderer } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import Mention from '@tiptap/extension-mention';
import { useCallback, useEffect, useImperativeHandle, forwardRef, useRef, useState } from 'react';
import tippy, { Instance as TippyInstance } from 'tippy.js';
import 'tippy.js/dist/tippy.css';
import { cn } from '@/lib/utils';
import { MentionSuggestionList } from './MentionSuggestionList';
import { supabase } from '@/integrations/supabase/client';
import { getDisplayUsername } from '@/lib/utils';

export interface TiptapEditorRef {
  toggleBold: () => void;
  toggleItalic: () => void;
  toggleUnderline: () => void;
  focus: () => void;
  getMarkdown: () => string;
  getText: () => string;
  isEmpty: () => boolean;
  getCharCount: () => number;
}

interface TiptapEditorProps {
  initialContent?: string;
  onChange?: (markdown: string, plainText: string) => void;
  placeholder?: string;
  className?: string;
  editorClassName?: string;
  disabled?: boolean;
  maxLength?: number;
}

// Convert Tiptap JSON to Markdown
const toMarkdown = (json: any): string => {
  if (!json?.content) return '';
  
  const processNode = (node: any): string => {
    if (!node) return '';
    
    if (node.type === 'text') {
      let text = node.text || '';
      const marks = node.marks || [];
      
      // Apply marks in order: bold > italic > underline
      marks.forEach((mark: any) => {
        if (mark.type === 'bold') {
          text = `**${text}**`;
        } else if (mark.type === 'italic') {
          text = `_${text}_`;
        } else if (mark.type === 'underline') {
          text = `~${text}~`;
        }
      });
      
      return text;
    }
    
    if (node.type === 'mention') {
      return `@${node.attrs?.id || node.attrs?.label || ''}`;
    }
    
    if (node.type === 'paragraph') {
      const content = (node.content || []).map(processNode).join('');
      return content;
    }
    
    if (node.type === 'hardBreak') {
      return '\n';
    }
    
    return '';
  };
  
  return json.content
    .map((block: any) => processNode(block))
    .join('\n');
};

// Parse Markdown to Tiptap-compatible content  
const parseMarkdownToContent = (markdown: string): string => {
  // For now, just return the raw text - Tiptap will handle it as plain text
  // Full markdown parsing would require more complex logic
  return markdown;
};

const TiptapEditor = forwardRef<TiptapEditorRef, TiptapEditorProps>(({
  initialContent = '',
  onChange,
  placeholder = 'Cosa sta succedendo?',
  className,
  editorClassName,
  disabled = false,
  maxLength = 3000
}, ref) => {
  const [mentionQuery, setMentionQuery] = useState('');
  
  // Create suggestion plugin for mentions
  const suggestion = {
    char: '@',
    allowSpaces: false,
    
    items: async ({ query }: { query: string }) => {
      if (!query || query.length < 2) return [];
      
      try {
        const { data, error } = await supabase
          .from('public_profiles')
          .select('id, username, full_name, avatar_url')
          .or(`username.ilike.%${query}%,full_name.ilike.%${query}%`)
          .limit(5);
        
        if (error) throw error;
        
        return (data || []).map(user => ({
          id: user.username,
          label: user.full_name || getDisplayUsername(user.username),
          username: getDisplayUsername(user.username),
          avatar_url: user.avatar_url,
          full_name: user.full_name
        }));
      } catch (e) {
        console.error('[TiptapEditor] Mention search error:', e);
        return [];
      }
    },
    
    render: () => {
      let component: ReactRenderer | null = null;
      let popup: TippyInstance[] | null = null;
      
      return {
        onStart: (props: any) => {
          component = new ReactRenderer(MentionSuggestionList, {
            props: {
              ...props,
              onKeyDown: (event: KeyboardEvent) => {
                if (event.key === 'Escape') {
                  popup?.[0]?.hide();
                  return true;
                }
                return (component?.ref as any)?.onKeyDown?.(event);
              }
            },
            editor: props.editor,
          });
          
          if (!props.clientRect) return;
          
          popup = tippy('body', {
            getReferenceClientRect: props.clientRect,
            appendTo: () => document.body,
            content: component.element,
            showOnCreate: true,
            interactive: true,
            trigger: 'manual',
            placement: 'bottom-start',
            popperOptions: {
              modifiers: [
                {
                  name: 'flip',
                  options: {
                    fallbackPlacements: ['top-start', 'bottom-start'],
                  },
                },
                {
                  name: 'preventOverflow',
                  options: {
                    boundary: 'viewport',
                    padding: 8,
                  },
                },
              ],
            },
            theme: 'mention-dropdown',
            maxWidth: 320,
            zIndex: 99999999,
          });
        },
        
        onUpdate: (props: any) => {
          component?.updateProps(props);
          
          if (!props.clientRect) {
            return;
          }
          
          popup?.[0]?.setProps({
            getReferenceClientRect: props.clientRect,
          });
        },
        
        onKeyDown: (props: any) => {
          if (props.event.key === 'Escape') {
            popup?.[0]?.hide();
            return true;
          }
          
          return (component?.ref as any)?.onKeyDown?.(props.event);
        },
        
        onExit: () => {
          popup?.[0]?.destroy();
          component?.destroy();
        },
      };
    },
  };
  
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Disable features we don't need
        heading: false,
        blockquote: false,
        codeBlock: false,
        code: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
        horizontalRule: false,
        // Some builds can include underline through StarterKit presets; avoid duplicate name warnings.
        // (Tiptap will ignore unknown keys, but in builds where it's supported it disables it.)
        underline: false as any,
      }),
      Underline,
      Placeholder.configure({
        placeholder,
        emptyEditorClass: 'is-editor-empty',
      }),
      Mention.configure({
        HTMLAttributes: {
          class: 'mention',
        },
        suggestion,
        renderHTML({ options, node }) {
          return [
            'span',
            {
              class: 'mention',
              'data-type': 'mention',
              'data-id': node.attrs.id,
            },
            `@${node.attrs.label ?? node.attrs.id}`,
          ];
        },
      }),
    ],
    content: initialContent,
    editable: !disabled,
    onUpdate: ({ editor }) => {
      const json = editor.getJSON();
      const markdown = toMarkdown(json);
      const plainText = editor.getText();
      onChange?.(markdown, plainText);
    },
    editorProps: {
      attributes: {
        class: cn(
          'prose prose-invert max-w-none focus:outline-none',
          'min-h-[120px] text-[17px] leading-relaxed',
          editorClassName
        ),
      },
      handleKeyDown: (view, event) => {
        // Prevent Enter from creating new paragraphs when at max length
        if (event.key === 'Enter' && !event.shiftKey) {
          const text = view.state.doc.textContent;
          if (text.length >= maxLength) {
            return true;
          }
        }
        return false;
      },
    },
  });
  
  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    toggleBold: () => {
      editor?.chain().focus().toggleBold().run();
    },
    toggleItalic: () => {
      editor?.chain().focus().toggleItalic().run();
    },
    toggleUnderline: () => {
      editor?.chain().focus().toggleUnderline().run();
    },
    focus: () => {
      editor?.commands.focus();
    },
    getMarkdown: () => {
      if (!editor) return '';
      return toMarkdown(editor.getJSON());
    },
    getText: () => {
      return editor?.getText() || '';
    },
    isEmpty: () => {
      return editor?.isEmpty ?? true;
    },
    getCharCount: () => {
      // Count actual characters for limit, but markdown for storage
      const markdown = editor ? toMarkdown(editor.getJSON()) : '';
      return markdown.length;
    },
  }), [editor]);
  
  // Update content when initialContent changes externally
  useEffect(() => {
    if (editor && initialContent !== toMarkdown(editor.getJSON())) {
      // Only update if content actually changed
      // This prevents cursor jumps during typing
    }
  }, [initialContent, editor]);
  
  // Clean up
  useEffect(() => {
    return () => {
      editor?.destroy();
    };
  }, []);
  
  if (!editor) {
    return null;
  }
  
  return (
    <div className={cn('tiptap-editor-wrapper', className)}>
      <EditorContent editor={editor} />
      
      <style>{`
        .tiptap-editor-wrapper .ProseMirror {
          outline: none;
          color: hsl(var(--foreground));
        }
        
        .tiptap-editor-wrapper .ProseMirror p {
          margin: 0;
        }
        
        .tiptap-editor-wrapper .ProseMirror p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          color: hsl(var(--muted-foreground));
          float: left;
          height: 0;
          pointer-events: none;
        }
        
        .tiptap-editor-wrapper .ProseMirror .mention {
          background: hsl(var(--primary) / 0.15);
          color: hsl(var(--primary));
          border-radius: 4px;
          padding: 1px 4px;
          font-weight: 500;
          text-decoration: none;
        }
        
        .tiptap-editor-wrapper .ProseMirror strong {
          font-weight: 700;
        }
        
        .tiptap-editor-wrapper .ProseMirror em {
          font-style: italic;
        }
        
        .tiptap-editor-wrapper .ProseMirror u {
          text-decoration: underline;
        }
        
        /* Tippy theme for mention dropdown */
        .tippy-box[data-theme~='mention-dropdown'] {
          background: hsl(24 10% 10% / 0.98);
          border: 1px solid hsl(var(--border));
          border-radius: 12px;
          box-shadow: 0 8px 30px rgba(0, 0, 0, 0.4);
          padding: 0;
          overflow: hidden;
        }
        
        .tippy-box[data-theme~='mention-dropdown'] .tippy-content {
          padding: 0;
        }
        
        .tippy-box[data-theme~='mention-dropdown'] .tippy-arrow {
          display: none;
        }
      `}</style>
    </div>
  );
});

TiptapEditor.displayName = 'TiptapEditor';

export { TiptapEditor };
