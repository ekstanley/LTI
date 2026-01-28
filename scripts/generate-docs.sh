#!/bin/bash
# LTIP Documentation Generator
# Converts Enhanced Markdown files to PDF or Word format using Pandoc

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DOCS_DIR="$PROJECT_ROOT/docs"
OUTPUT_DIR="$DOCS_DIR/pdf"

# Default format
FORMAT="${1:-pdf}"

# Excluded files (CLAUDE.md, AGENTS.md)
EXCLUDED_PATTERNS=("CLAUDE.md" "AGENTS.md")

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Function to check if file should be excluded
should_exclude() {
    local file="$1"
    local basename=$(basename "$file")

    for pattern in "${EXCLUDED_PATTERNS[@]}"; do
        if [[ "$basename" == "$pattern" ]]; then
            return 0
        fi
    done
    return 1
}

# Function to convert a single file
convert_file() {
    local input="$1"
    local format="$2"
    local basename=$(basename "$input" .md)
    local relative_dir=$(dirname "${input#$DOCS_DIR/}")

    # Create subdirectory in output if needed
    local output_subdir="$OUTPUT_DIR"
    if [[ "$relative_dir" != "." && "$relative_dir" != "$DOCS_DIR" ]]; then
        output_subdir="$OUTPUT_DIR/$relative_dir"
        mkdir -p "$output_subdir"
    fi

    local output
    case "$format" in
        pdf)
            output="$output_subdir/${basename}.pdf"
            echo "Converting $input -> $output"
            pandoc "$input" \
                --from=gfm+tex_math_dollars+pipe_tables+strikeout+task_lists \
                --to=pdf \
                --pdf-engine=xelatex \
                -V geometry:margin=1in \
                -V fontsize=11pt \
                -V colorlinks=true \
                -V linkcolor=blue \
                --toc \
                --toc-depth=3 \
                --highlight-style=tango \
                -o "$output" 2>/dev/null || {
                    # Fallback without toc if document is too short
                    pandoc "$input" \
                        --from=gfm+tex_math_dollars+pipe_tables+strikeout+task_lists \
                        --to=pdf \
                        --pdf-engine=xelatex \
                        -V geometry:margin=1in \
                        -V fontsize=11pt \
                        -V colorlinks=true \
                        -V linkcolor=blue \
                        --highlight-style=tango \
                        -o "$output"
                }
            ;;
        word|docx)
            output="$output_subdir/${basename}.docx"
            echo "Converting $input -> $output"
            pandoc "$input" \
                --from=gfm+tex_math_dollars+pipe_tables+strikeout+task_lists \
                --to=docx \
                --toc \
                --toc-depth=3 \
                --highlight-style=tango \
                -o "$output"
            ;;
        *)
            echo "Error: Unknown format '$format'. Use 'pdf' or 'word'."
            exit 1
            ;;
    esac
}

# Find and convert all markdown files in docs/
echo "LTIP Documentation Generator"
echo "============================"
echo "Format: $FORMAT"
echo "Output: $OUTPUT_DIR"
echo ""

count=0
while IFS= read -r -d '' file; do
    if should_exclude "$file"; then
        echo "Skipping excluded file: $file"
        continue
    fi

    convert_file "$file" "$FORMAT"
    ((count++))
done < <(find "$DOCS_DIR" -name "*.md" -type f -print0 2>/dev/null)

# Also check for any markdown in project root (except excluded)
for file in "$PROJECT_ROOT"/*.md; do
    if [[ -f "$file" ]]; then
        if should_exclude "$file"; then
            echo "Skipping excluded file: $file"
            continue
        fi
        convert_file "$file" "$FORMAT"
        ((count++))
    fi
done

echo ""
echo "============================"
echo "Generated $count document(s)"
echo "Output directory: $OUTPUT_DIR"
