import { useCallback, useEffect, useRef, useState } from "react";
import katex from "katex";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export type MathMode = "inline" | "block";

export interface MathInputDialogProps {
  open: boolean;
  mode: MathMode;
  initialLatex?: string;
  onConfirm: (latex: string, mode: MathMode) => void;
  onCancel: () => void;
}

export function MathInputDialog({
  open,
  mode,
  initialLatex = "",
  onConfirm,
  onCancel,
}: MathInputDialogProps) {
  const [latex, setLatex] = useState(initialLatex);
  const [error, setError] = useState<string | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setLatex(initialLatex);
      setError(null);
      // Auto-focus textarea after dialog animation
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [open, initialLatex]);

  // Live KaTeX preview
  useEffect(() => {
    if (!previewRef.current) return;
    if (!latex.trim()) {
      previewRef.current.innerHTML =
        '<span class="text-muted-foreground text-sm italic">Preview will appear here...</span>';
      setError(null);
      return;
    }
    try {
      katex.render(latex, previewRef.current, {
        throwOnError: true,
        displayMode: mode === "block",
      });
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid LaTeX");
      previewRef.current.innerHTML = "";
    }
  }, [latex, mode]);

  const handleConfirm = useCallback(() => {
    const trimmed = latex.trim();
    if (trimmed) {
      onConfirm(trimmed, mode);
    }
  }, [latex, mode, onConfirm]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Ctrl/Cmd+Enter to confirm
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleConfirm();
      }
    },
    [handleConfirm]
  );

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>
            {initialLatex ? "Edit" : "Insert"}{" "}
            {mode === "inline" ? "Inline" : "Block"} Math
          </DialogTitle>
          <DialogDescription>
            Enter a LaTeX formula. Press Ctrl+Enter to confirm.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* LaTeX input */}
          <div className="space-y-2">
            <Label htmlFor="math-latex-input">LaTeX Formula</Label>
            <Textarea
              ref={textareaRef}
              id="math-latex-input"
              value={latex}
              onChange={(e) => setLatex(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                mode === "inline"
                  ? "e.g. x^2 + y^2 = z^2"
                  : "e.g. \\sum_{n=1}^{\\infty} \\frac{1}{n^2} = \\frac{\\pi^2}{6}"
              }
              className="font-mono text-sm min-h-[80px] resize-y"
              rows={3}
            />
          </div>

          {/* Live preview */}
          <div className="space-y-2">
            <Label>Preview</Label>
            <div
              ref={previewRef}
              className={`min-h-[48px] rounded-md border bg-muted/30 p-3 overflow-x-auto ${
                mode === "block" ? "text-center" : ""
              }`}
            />
            {error && (
              <p className="text-xs text-destructive">{error}</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!latex.trim()}>
            {initialLatex ? "Update" : "Insert"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
