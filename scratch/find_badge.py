import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('src/components/AdminDashboard.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find the mobile cards section line numbers
start_line = None
end_line = None
for i, line in enumerate(lines):
    if 'Mobile Cards \u2014 with selfie' in line:
        start_line = i
    if start_line and i > start_line and '</div>' in line:
        # Find the closing div of the space-y-3 container
        # Count nesting
        pass

# Print lines around the marker
if start_line:
    print(f'Start at line {start_line+1}')
    print(repr(lines[start_line][:80]))
    print(repr(lines[start_line+1][:80]))
    
    # Find end: the next </div> that closes "lg:hidden space-y-3"
    # Find pagination section
    for i in range(start_line, min(len(lines), start_line+120)):
        if 'Pagination' in lines[i] or 'totalPages' in lines[i]:
            end_line = i - 1
            print(f'End at line {end_line+1}')
            print(repr(lines[end_line][:80]))
            break

    if end_line:
        # Show indentation of start
        indent = len(lines[start_line]) - len(lines[start_line].lstrip())
        print(f'Indent chars: {indent}')
