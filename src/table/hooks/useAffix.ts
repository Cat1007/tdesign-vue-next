import isBoolean from 'lodash/isBoolean';
import { computed, ref, watch, onBeforeUnmount } from 'vue';
import { TdBaseTableProps } from '../type';
import { on, off } from '../../utils/dom';
import { AffixProps } from '../../affix';

/**
 * 1. 表头吸顶（普通表头吸顶 和 虚拟滚动表头吸顶）
 * 2. 表尾吸底
 * 3. 底部滚动条吸底
 * 4. 分页器吸底
 */
export default function useAffix(props: TdBaseTableProps) {
  const tableContentRef = ref<HTMLDivElement>();
  // 吸顶表头
  const affixHeaderRef = ref<HTMLDivElement>();
  // 吸底表尾
  const affixFooterRef = ref<HTMLDivElement>();
  // 吸底滚动条
  const horizontalScrollbarRef = ref<HTMLDivElement>();
  // 吸底分页器
  const paginationRef = ref<HTMLDivElement>();
  // 当表格完全滚动消失在视野时，需要隐藏吸顶表头
  const showAffixHeader = ref(true);
  // 当表格完全滚动消失在视野时，需要隐藏吸底尾部
  const showAffixFooter = ref(true);
  // 当表格完全滚动消失在视野时，需要隐藏吸底分页器
  const showAffixPagination = ref(true);

  const isVirtualScroll = computed(
    () => props.scroll && props.scroll.type === 'virtual' && (props.scroll.threshold || 100) < props.data.length,
  );

  const isAffixed = computed(
    () => !!(props.headerAffixedTop || props.footerAffixedBottom || props.horizontalScrollAffixedBottom),
  );

  let lastScrollLeft = 0;
  const onHorizontalScroll = (scrollElement?: HTMLElement) => {
    if (!isAffixed.value && !isVirtualScroll.value) return;
    let target = scrollElement;
    if (!target && tableContentRef.value) {
      lastScrollLeft = 0;
      target = tableContentRef.value;
    }
    if (!target) return;
    const left = target.scrollLeft;
    // 如果 lastScrollLeft 等于 left，说明不是横向滚动，不需要更新横向滚动距离
    if (lastScrollLeft === left) return;
    lastScrollLeft = left;
    // 表格内容、吸顶表头、吸底表尾、吸底横向滚动更新
    const toUpdateScrollElement = [
      tableContentRef.value,
      affixHeaderRef.value,
      affixFooterRef.value,
      horizontalScrollbarRef.value,
    ];
    for (let i = 0, len = toUpdateScrollElement.length; i < len; i++) {
      if (toUpdateScrollElement[i] && scrollElement !== toUpdateScrollElement[i]) {
        toUpdateScrollElement[i].scrollLeft = left;
      }
    }
  };

  // 吸底的元素（footer、横向滚动条、分页器）是否显示
  const isAffixedBottomElementShow = (elementRect: DOMRect, tableRect: DOMRect, headerHeight: number) =>
    tableRect.top + headerHeight < elementRect.top && elementRect.top > elementRect.height;

  const getOffsetTop = (props: boolean | AffixProps) => {
    if (isBoolean(props)) return 0;
    return props.offsetTop || 0;
  };

  const updateAffixHeaderOrFooter = () => {
    if (!isAffixed.value && !isVirtualScroll.value) return;
    const pos = tableContentRef.value?.getBoundingClientRect();
    const headerRect = tableContentRef.value?.querySelector('thead')?.getBoundingClientRect();
    const headerHeight = headerRect?.height || 0;
    const footerRect = affixFooterRef.value?.getBoundingClientRect();
    if ((props.headerAffixedTop || isVirtualScroll.value) && affixHeaderRef.value) {
      const offsetTop = getOffsetTop(props.headerAffixProps || props.headerAffixedTop);
      const footerHeight = footerRect?.height || 0;
      let r = Math.abs(pos.top) < pos.height - headerHeight - offsetTop - footerHeight;
      // 如果是虚拟滚动的表头，只要表头在可视区域内，一律永久显示（虚拟滚动表头 和 吸顶表头可能同时存在）
      if (isVirtualScroll.value) {
        r = pos.top > -1 * headerRect.height;
      }
      showAffixHeader.value = r;
    }
    // 底部内容吸底 和 底部滚动条吸底，不可能同时存在，二选一即可
    if (props.footerAffixedBottom && affixFooterRef?.value) {
      showAffixFooter.value = isAffixedBottomElementShow(footerRect, pos, headerHeight);
    } else if (props.horizontalScrollAffixedBottom && horizontalScrollbarRef?.value) {
      const horizontalScrollbarRect = horizontalScrollbarRef.value.getBoundingClientRect();
      showAffixFooter.value = isAffixedBottomElementShow(horizontalScrollbarRect, pos, headerHeight);
    }
    if (props.paginationAffixedBottom && paginationRef.value) {
      const pageRect = paginationRef.value.getBoundingClientRect();
      showAffixPagination.value = isAffixedBottomElementShow(pageRect, pos, headerHeight);
    }
  };

  const onDocumentScroll = () => {
    updateAffixHeaderOrFooter();
  };

  const onFootScroll = () => {
    onHorizontalScroll(affixFooterRef.value);
  };

  const onHeaderScroll = () => {
    onHorizontalScroll(affixHeaderRef.value);
  };

  const horizontalScrollbarScroll = () => {
    onHorizontalScroll(horizontalScrollbarRef.value);
  };

  const onTableContentScroll = () => {
    onHorizontalScroll(tableContentRef.value);
  };

  const onFootMouseEnter = (event: UIEvent) => {
    if (event.composedPath().includes(affixFooterRef.value)) {
      removeHorizontalScrollListeners();
      on(affixFooterRef.value, 'scroll', onFootScroll);
    }
  };

  const onHeaderMouseEnter = (event: UIEvent) => {
    if (event.composedPath().includes(affixHeaderRef.value)) {
      removeHorizontalScrollListeners();
      on(affixHeaderRef.value, 'scroll', onHeaderScroll);
    }
  };

  const onScrollbarMouseEnter = (event: UIEvent) => {
    if (event.composedPath().includes(horizontalScrollbarRef.value)) {
      removeHorizontalScrollListeners();
      on(horizontalScrollbarRef.value, 'scroll', horizontalScrollbarScroll);
    }
  };

  const onTableContentMouseEnter = (event: UIEvent) => {
    if (event.composedPath().includes(tableContentRef.value)) {
      removeHorizontalScrollListeners();
      on(tableContentRef.value, 'scroll', onTableContentScroll);
    }
  };

  const removeHorizontalScrollListeners = () => {
    off(affixFooterRef.value, 'scroll', onFootScroll);
    off(affixHeaderRef.value, 'scroll', onHeaderScroll);
    off(horizontalScrollbarRef.value, 'scroll', horizontalScrollbarScroll);
    off(tableContentRef.value, 'scroll', onTableContentScroll);
  };

  const addHorizontalScrollElementEnterListeners = () => {
    if (affixHeaderRef.value) {
      on(affixHeaderRef.value, 'mouseenter', onHeaderMouseEnter);
      on(affixHeaderRef.value, 'touchstart', onHeaderMouseEnter);
    }

    if (props.footerAffixedBottom && affixFooterRef.value) {
      on(affixFooterRef.value, 'mouseenter', onFootMouseEnter);
      on(affixFooterRef.value, 'touchstart', onFootMouseEnter);
    }

    if (props.horizontalScrollAffixedBottom && horizontalScrollbarRef.value) {
      on(horizontalScrollbarRef.value, 'mouseenter', onScrollbarMouseEnter);
      on(horizontalScrollbarRef.value, 'touchstart', onScrollbarMouseEnter);
    }

    if ((isAffixed.value || isVirtualScroll.value) && tableContentRef.value) {
      on(tableContentRef.value, 'mouseenter', onTableContentMouseEnter);
      on(tableContentRef.value, 'touchstart', onTableContentMouseEnter);
    }
  };

  const removeHorizontalScrollElementEnterListeners = () => {
    if (affixHeaderRef.value) {
      off(affixHeaderRef.value, 'mouseenter', onHeaderMouseEnter);
      off(affixHeaderRef.value, 'touchstart', onHeaderMouseEnter);
    }
    if (affixFooterRef.value) {
      off(affixFooterRef.value, 'mouseenter', onFootMouseEnter);
      off(affixFooterRef.value, 'touchstart', onFootMouseEnter);
    }
    if (tableContentRef.value) {
      off(tableContentRef.value, 'mouseenter', onTableContentMouseEnter);
      off(tableContentRef.value, 'touchstart', onTableContentMouseEnter);
    }
    if (horizontalScrollbarRef.value) {
      off(horizontalScrollbarRef.value, 'mouseenter', onScrollbarMouseEnter);
      off(horizontalScrollbarRef.value, 'touchstart', onScrollbarMouseEnter);
    }
  };

  const addVerticalScrollListener = () => {
    if (!isAffixed.value && !props.paginationAffixedBottom) return;
    const timer = setTimeout(() => {
      if (isAffixed.value || props.paginationAffixedBottom) {
        on(document, 'scroll', onDocumentScroll);
      } else {
        off(document, 'scroll', onDocumentScroll);
      }
      clearTimeout(timer);
    });
  };

  watch([affixHeaderRef, affixFooterRef, horizontalScrollbarRef, tableContentRef], () => {
    addHorizontalScrollElementEnterListeners();
    onHorizontalScroll();
    updateAffixHeaderOrFooter();
  });

  watch(isAffixed, addVerticalScrollListener);

  watch(
    () => [
      props.data,
      props.columns,
      props.headerAffixedTop,
      props.footerAffixedBottom,
      props.horizontalScrollAffixedBottom,
    ],
    () => {
      onHorizontalScroll();
    },
  );

  onBeforeUnmount(() => {
    off(document, 'scroll', onDocumentScroll);
    removeHorizontalScrollElementEnterListeners();
  });

  const setTableContentRef = (tableContent: HTMLDivElement) => {
    tableContentRef.value = tableContent;
    addVerticalScrollListener();
  };

  return {
    showAffixHeader,
    showAffixFooter,
    showAffixPagination,
    affixHeaderRef,
    affixFooterRef,
    horizontalScrollbarRef,
    paginationRef,
    onHorizontalScroll,
    setTableContentRef,
    updateAffixHeaderOrFooter,
  };
}
