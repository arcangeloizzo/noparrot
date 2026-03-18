const fs = require('fs');
const file = 'src/components/tutorial/OnboardingTutorial.tsx';
let content = fs.readFileSync(file, 'utf8');

// The fundamental problem is trying to use \`left: 50%, transform: translateX(-50%)\` 
// on an absolute element that also has \`width: 100vw\` or \`w-full\` which guarantees it overflows the right edge.
// And vertical positions are breaking because it's not accounting for the window height properly.

// Let's replace the whole style calculation logic with a much simpler block.

const targetBlockStart = '    // Calculate tooltip position based on content preference and screen bounds';
const targetBlockEnd = '      zIndex: 100,\n    };';

const newLogic = \`    // Simplified and robust positioning logic
    const padding = 16;
    const isMobile = window.innerWidth < 640;
    const tooltipWidth = Math.min(320, window.innerWidth - (padding * 2));
    const tooltipHeight = 200; // Estimated height
    
    // Vertical positioning
    let tooltipTop = 0;
    if (content.position === "bottom") {
      tooltipTop = bottom + padding;
      // If it overflows the bottom of the screen, flip it to the top
      if (tooltipTop + tooltipHeight > window.innerHeight) {
        tooltipTop = top - tooltipHeight - padding;
      }
    } else if (content.position === "top") {
      tooltipTop = top - tooltipHeight - (padding * 2);
      // If it overflows the top of the screen, flip it to the bottom
      if (tooltipTop < 0) {
        tooltipTop = bottom + padding;
      }
    }
    
    // Fallback if still totally offscreen
    if (tooltipTop < 0) tooltipTop = padding;
    if (tooltipTop > window.innerHeight - tooltipHeight) tooltipTop = window.innerHeight - tooltipHeight - padding;

    // Horizontal positioning
    let tooltipLeft = 0;
    if (isMobile) {
      // On mobile, just center it on the screen perfectly using absolute math, ignoring the target
      tooltipLeft = (window.innerWidth - tooltipWidth) / 2;
    } else {
      // On desktop, try to center it on the target
      tooltipLeft = targetRect.left + (targetRect.width / 2) - (tooltipWidth / 2);
      
      // Keep it within screen bounds
      if (tooltipLeft < padding) tooltipLeft = padding;
      if (tooltipLeft + tooltipWidth > window.innerWidth - padding) {
        tooltipLeft = window.innerWidth - tooltipWidth - padding;
      }
    }

    tooltipStyle = {
      top: \\\`\\\${tooltipTop}px\\\`,
      left: \\\`\\\${tooltipLeft}px\\\`,
      position: "absolute",
      width: \\\`\\\${tooltipWidth}px\\\`,
      zIndex: 100,
    };\`;

const startIndex = content.indexOf(targetBlockStart);
const endIndex = content.indexOf(targetBlockEnd) + targetBlockEnd.length;

if (startIndex !== -1 && endIndex !== -1) {
    content = content.substring(0, startIndex) + newLogic + content.substring(endIndex);
    fs.writeFileSync(file, content);
    console.log("Patched layout logic successfully");
} else {
    console.log("Failed to find replacement block", startIndex, endIndex);
}
