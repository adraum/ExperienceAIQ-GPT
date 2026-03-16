import html2canvas from 'html2canvas';

export const downloadChartAsImage = async (elementId: string, filename: string) => {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`Element with id ${elementId} not found`);
    return;
  }

  try {
    // Find the maximum scroll width and height among the element's children
    const scrollElements = element.querySelectorAll('*');
    let maxChildWidth = 0;
    let maxChildHeight = 0;

    scrollElements.forEach((el) => {
      if (el.scrollWidth > maxChildWidth) maxChildWidth = el.scrollWidth;
      if (el.scrollHeight > maxChildHeight) maxChildHeight = el.scrollHeight;
    });

    const computedStyle = window.getComputedStyle(element);
    const paddingLeft = parseFloat(computedStyle.paddingLeft) || 0;
    const paddingRight = parseFloat(computedStyle.paddingRight) || 0;
    const paddingTop = parseFloat(computedStyle.paddingTop) || 0;
    const paddingBottom = parseFloat(computedStyle.paddingBottom) || 0;
    
    const targetWidth = Math.max(element.scrollWidth, maxChildWidth + paddingLeft + paddingRight);
    const targetHeight = Math.max(element.scrollHeight, maxChildHeight + paddingTop + paddingBottom);

    // Store original styles
    const originalStyles = new Map<HTMLElement, { 
      width: string, height: string, maxWidth: string, maxHeight: string, 
      overflow: string, overflowX: string, overflowY: string 
    }>();

    // Save and modify root element
    originalStyles.set(element, {
      width: element.style.width,
      height: element.style.height,
      maxWidth: element.style.maxWidth,
      maxHeight: element.style.maxHeight,
      overflow: element.style.overflow,
      overflowX: element.style.overflowX,
      overflowY: element.style.overflowY,
    });

    element.style.width = `${targetWidth}px`;
    element.style.height = `${targetHeight}px`;
    element.style.maxWidth = 'none';
    element.style.maxHeight = 'none';

    // Save and modify all scrollable children
    const modifiedClasses = new Map<HTMLElement, string[]>();
    
    scrollElements.forEach((el) => {
      const htmlEl = el as HTMLElement;
      const compStyle = window.getComputedStyle(htmlEl);
      
      if (compStyle.overflowX === 'auto' || compStyle.overflowX === 'scroll' || 
          compStyle.overflowY === 'auto' || compStyle.overflowY === 'scroll' ||
          htmlEl.classList.contains('overflow-x-auto') || htmlEl.classList.contains('overflow-y-auto') ||
          htmlEl.classList.contains('overflow-hidden')) {
        
        originalStyles.set(htmlEl, {
          width: htmlEl.style.width,
          height: htmlEl.style.height,
          maxWidth: htmlEl.style.maxWidth,
          maxHeight: htmlEl.style.maxHeight,
          overflow: htmlEl.style.overflow,
          overflowX: htmlEl.style.overflowX,
          overflowY: htmlEl.style.overflowY,
        });
        
        const classesToRemove = ['overflow-x-auto', 'overflow-y-auto', 'overflow-hidden', 'overflow-auto', 'overflow-scroll'];
        const removed: string[] = [];
        classesToRemove.forEach(cls => {
          if (htmlEl.classList.contains(cls)) {
            htmlEl.classList.remove(cls);
            removed.push(cls);
          }
        });
        if (removed.length > 0) {
          modifiedClasses.set(htmlEl, removed);
        }
        
        htmlEl.style.setProperty('overflow', 'visible', 'important');
        htmlEl.style.setProperty('overflow-x', 'visible', 'important');
        htmlEl.style.setProperty('overflow-y', 'visible', 'important');
        
        htmlEl.style.setProperty('width', `${targetWidth}px`, 'important');
        htmlEl.style.setProperty('max-width', 'none', 'important');
      }
    });

    // Wait a tick for the browser to apply the layout changes
    await new Promise(resolve => setTimeout(resolve, 100));

    const canvas = await html2canvas(element, {
      scale: 2, // Higher resolution
      backgroundColor: '#ffffff',
      width: targetWidth,
      height: targetHeight,
      windowWidth: targetWidth,
      windowHeight: targetHeight,
      useCORS: true,
      logging: false,
    });
    
    // Restore original styles immediately after capture
    originalStyles.forEach((styles, el) => {
      el.style.width = styles.width;
      el.style.height = styles.height;
      el.style.maxWidth = styles.maxWidth;
      el.style.maxHeight = styles.maxHeight;
      el.style.overflow = styles.overflow;
      el.style.overflowX = styles.overflowX;
      el.style.overflowY = styles.overflowY;
    });

    modifiedClasses.forEach((classes, el) => {
      classes.forEach(cls => el.classList.add(cls));
    });

    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `${filename}.png`;
    link.click();
  } catch (error) {
    console.error('Error generating image:', error);
  }
};
