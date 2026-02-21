import { useCallback, useEffect, useRef } from 'react';
import { useObserveScrollPosition } from 'react-scroll-to-bottom';

// Module-level map: persists scroll positions across component remounts
const scrollPositionMap = new Map<number, number>();

interface ScrollPositionManagerProps {
    chatIndex: number;
}

/**
 * Find the scrollable parent element (the one managed by react-scroll-to-bottom).
 * The library creates a div with overflow-y: auto that contains the content.
 */
const findScrollableParent = (element: HTMLElement | null): HTMLElement | null => {
    let current = element;
    while (current) {
        const style = window.getComputedStyle(current);
        if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
            return current;
        }
        current = current.parentElement;
    }
    return null;
};

/**
 * Manages scroll position save/restore for chat switching.
 * Must be rendered inside <ScrollToBottom> to access its context.
 *
 * - On mount: restores saved scroll position (instant, no animation)
 * - While mounted: continuously tracks scrollTop via useObserveScrollPosition
 * - On unmount: saves current scrollTop to the map
 */
const ScrollPositionManager = ({ chatIndex }: ScrollPositionManagerProps) => {
    const scrollTopRef = useRef<number>(0);
    const markerRef = useRef<HTMLDivElement>(null);

    // Track scroll position continuously via the library's observer
    const handleScrollPosition = useCallback(
        ({ scrollTop }: { scrollTop: number }) => {
            scrollTopRef.current = scrollTop;
        },
        []
    );

    useObserveScrollPosition(handleScrollPosition);

    // Restore saved scroll position on mount, save on unmount
    useEffect(() => {
        const savedPosition = scrollPositionMap.get(chatIndex);

        if (savedPosition !== undefined && savedPosition > 0) {
            // Use requestAnimationFrame to ensure layout is complete
            requestAnimationFrame(() => {
                const scrollContainer = findScrollableParent(markerRef.current);
                if (scrollContainer) {
                    scrollContainer.scrollTop = savedPosition;
                }
            });
        }

        return () => {
            scrollPositionMap.set(chatIndex, scrollTopRef.current);
        };
    }, [chatIndex]);

    // Render a hidden marker element to find the scroll container
    return <div ref={markerRef} style={{ display: 'none' }} />;
};

export default ScrollPositionManager;
