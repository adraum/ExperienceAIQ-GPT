import * as htmlToImage from 'html-to-image';

export const downloadChartAsImage = async (elementId: string, filename: string) => {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`Element with id ${elementId} not found`);
    return;
  }

  try {
    // Special case for heatmap to capture full scrollable content
    const isHeatmap = elementId === 'chart-cx-heatmap';
    const originalStyles = new Map<HTMLElement, { width: string, height: string, overflow: string, overflowX: string, overflowY: string }>();
    let scrollContainer: HTMLElement | null = null;

    if (isHeatmap) {
      // Find the scrollable container inside the heatmap
      scrollContainer = element.querySelector('.overflow-x-auto') as HTMLElement;
      if (scrollContainer) {
        const content = scrollContainer.firstElementChild as HTMLElement;
        if (content) {
          // Save original styles
          originalStyles.set(element, {
            width: element.style.width,
            height: element.style.height,
            overflow: element.style.overflow,
            overflowX: element.style.overflowX,
            overflowY: element.style.overflowY,
          });
          originalStyles.set(scrollContainer, {
            width: scrollContainer.style.width,
            height: scrollContainer.style.height,
            overflow: scrollContainer.style.overflow,
            overflowX: scrollContainer.style.overflowX,
            overflowY: scrollContainer.style.overflowY,
          });

          // Temporarily expand the container to fit the full content
          const fullWidth = content.scrollWidth;
          // 64px accounts for the p-8 (32px) padding on both sides of the parent container
          element.style.width = `${fullWidth + 64}px`; 
          scrollContainer.style.overflow = 'visible';
          scrollContainer.style.overflowX = 'visible';
          scrollContainer.style.width = `${fullWidth}px`;

          // Wait a tick for layout to update
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    }

    const dataUrl = await htmlToImage.toPng(element, {
      quality: 1.0,
      pixelRatio: 2,
      backgroundColor: '#ffffff',
      style: {
        transform: 'scale(1)',
        transformOrigin: 'top left',
      }
    });

    // Restore original styles
    if (isHeatmap && scrollContainer) {
      originalStyles.forEach((styles, el) => {
        el.style.width = styles.width;
        el.style.height = styles.height;
        el.style.overflow = styles.overflow;
        el.style.overflowX = styles.overflowX;
        el.style.overflowY = styles.overflowY;
      });
    }

    const link = document.createElement('a');
    link.download = `${filename}.png`;
    link.href = dataUrl;
    link.click();
  } catch (error) {
    console.error('Error generating image:', error);
  }
};
