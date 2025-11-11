/**
 * Uthr Custom JavaScript
 * 
 * @package Bootscore
 * @subpackage Uthr
 */

(function($) {
    'use strict';
    
    // Document Ready
    $(document).ready(function() {
        
        initCustomATCButton();
        // Initialize Uthr Components
        initSearchToggle();
        initOffcanvasMenu();
        initProductActions();
        // initSlickSliders();
        initWOWAnimations();
        initStickyHeader();
        initMiniCart();
        initCheckoutAjax();
        // initCheckoutPaymentMethods();
        
    });

    function initCustomATCButton() {
        
        // 初始化变体选择器（仅对变体商品）
        initVariationSelector();
        
     // 自定义添加到购物车
     $('.custom-atc-button').on('click', function() {
        // alert('add to cart');
        var button = $(this);
        var wrapper = button.closest('.custom-add-to-cart');
        // 尝试从多处获取商品ID，提升兼容性
        var productId = wrapper.data('product-id')
            || button.data('product-id')
            || (wrapper.find('input[name="product_id"]').val())
            || ($('input[name="product_id"]').first().val());
        productId = parseInt(productId, 10) || 0;
        var quantity = wrapper.find('.qty-input').val() || wrapper.find('input[name="quantity"]').val() || 1;
        quantity = parseInt(quantity, 10) || 1;
        var message = wrapper.find('.atc-message');
        
        // 获取变体ID（如果存在）- 尝试从多个可能的位置获取
        var variationId = 0;
        if ($('input.variation_id').length) {
            variationId = parseInt($('input.variation_id').val(), 10) || 0;
        }
        if (!variationId && wrapper.find('input[name="variation_id"]').length) {
            variationId = parseInt(wrapper.find('input[name="variation_id"]').val(), 10) || 0;
        }
        
        // 获取变体属性（如果存在）
        var variation = {};
        $('.variations select, .variations input[type="radio"]:checked').each(function() {
            var $field = $(this);
            var attributeName = $field.data('attribute_name') || $field.attr('name');
            if (attributeName) {
                // 移除 attribute_ 前缀（如果有）
                attributeName = attributeName.replace(/^attribute_/, '');
                variation[attributeName] = $field.val();
            }
        });

        if (!productId) {
            if (message.length) {
                message.html('<span style="color:red;">未能识别商品，请刷新页面重试</span>').show();
            } else {
                alert('未能识别商品，请刷新页面重试');
            }
            return;
        }
        
        // 显示加载状态
        button.find('.atc-text').hide();
        button.find('.loading-spinner').show();
        button.prop('disabled', true);
        
        // 准备AJAX数据
        var ajaxData = {
            action: 'custom_add_to_cart',
            product_id: productId,
            quantity: quantity || 1,
            nonce: (typeof uthr_ajax !== 'undefined' && uthr_ajax.nonce) ? uthr_ajax.nonce : ''
        };
        
        // 如果有变体ID，添加到数据中
        if (variationId && variationId > 0) {
            ajaxData.variation_id = variationId;
        }
        
        // 如果有变体属性，添加到数据中
        if (Object.keys(variation).length > 0) {
            ajaxData.variation = variation;
        }
        
        // AJAX请求
        $.ajax({
            type: 'POST',
            // 优先使用主题的 AJAX URL，其次使用 WooCommerce 的，最后使用 WordPress 默认的
            url: (typeof uthr_ajax !== 'undefined' && uthr_ajax.ajax_url)
                ? uthr_ajax.ajax_url
                : (typeof wc_add_to_cart_params !== 'undefined' && wc_add_to_cart_params.ajax_url)
                    ? wc_add_to_cart_params.ajax_url
                    : (typeof woocommerce_params !== 'undefined' && woocommerce_params.ajax_url)
                        ? woocommerce_params.ajax_url
                        : '/wp-admin/admin-ajax.php',
            data: ajaxData,
            success: function(response) {
                
                if (response.success) {
                    alert(response.data.message);
                    message.html('<span style="color:green;">✓ ' + response.data.message + '</span>');
                    
                    // 更新购物车图标数量
                    $('.cart-count').text(response.data.cart_count);
                    $('.cart-total').html(response.data.cart_total);
                    // 更新购物车数量与金额
                    $('.mini_cart_count').text(response.data.cart_count);
                    if (response.data.cart_subtotal) {
                        $('.mini_cart_subtotal').html(response.data.cart_subtotal);
                    }
                    if (response.data.cart_total) {
                        $('.mini_cart_total').html(response.data.cart_total);
                    }
                    
                    // 更新购物车内容
                    if (response.data.fragments) {
                        $.each(response.data.fragments, function(selector, html) {
                            $(selector).html(html);
                        });
                    }
                    
                    // 打开侧边购物车
                    openMiniCart();
                    
                    // 3秒后隐藏消息
                    setTimeout(function() {
                        message.fadeOut();
                    }, 3000);
                } else {
                    alert(response.data);
                    message.html('<span style="color:red;">✗ ' + response.data + '</span>');
                }
            },
            error: function(xhr, status, error) {
                console.error('AJAX Error:', status, error);
                console.error('Response:', xhr.responseText);
                var errorMsg = '网络错误，请重试';
                if (xhr.responseText) {
                    try {
                        var response = JSON.parse(xhr.responseText);
                        if (response.data) {
                            errorMsg = response.data;
                        }
                    } catch(e) {
                        // 如果无法解析JSON，使用默认消息
                    }
                }
                alert(errorMsg);
                message.html('<span style="color:red;">✗ ' + errorMsg + '</span>');
            },
            complete: function() {
                // alert('complete');
                // 恢复按钮状态
                button.find('.atc-text').show();
                button.find('.loading-spinner').hide();
                button.prop('disabled', false);
            }
        });
    });
    }

    // Mini Cart
    function initMiniCart() {
        // 打开购物车
        $(document).on('click', '.mini_cart_trigger', function(e) {
            e.preventDefault();
            fetchMiniCart(function() {
                openMiniCart();
            });
        });

        // 关闭购物车
        $(document).on('click', '.mini_cart_close a', function(e) {
            e.preventDefault();
            closeMiniCart();
        });
        $(document).on('click', '.body_overlay', function() {
            closeMiniCart();
        });

        // 删除购物车商品（事件委托）
        $(document).on('click', '.remove_cart_item', function(e) {
            e.preventDefault();
            var $link = $(this);
            var cartItemKey = $link.data('cart-item-key');

            $.ajax({
                type: 'POST',
                url: (typeof uthr_ajax !== 'undefined' && uthr_ajax.ajax_url)
                    ? uthr_ajax.ajax_url
                    : (typeof wc_add_to_cart_params !== 'undefined' && wc_add_to_cart_params.ajax_url)
                        ? wc_add_to_cart_params.ajax_url
                        : (typeof woocommerce_params !== 'undefined' && woocommerce_params.ajax_url)
                            ? woocommerce_params.ajax_url
                            : '/wp-admin/admin-ajax.php',
                data: {
                    action: 'uthr_remove_cart_item',
                    cart_item_key: cartItemKey,
                    nonce: (typeof uthr_ajax !== 'undefined' && uthr_ajax.nonce) ? uthr_ajax.nonce : ''
                },
                success: function(response) {
                    if (response.success) {
                        // 应用片段更新
                        if (response.data.fragments) {
                            $.each(response.data.fragments, function(selector, html) {
                                $(selector).html(html);
                            });
                        }
                        // 同步数量与金额
                        if (typeof response.data.cart_count !== 'undefined') {
                            $('.mini_cart_count').text(response.data.cart_count);
                        }
                        if (typeof response.data.cart_total !== 'undefined') {
                            $('.mini_cart_total').html(response.data.cart_total);
                        }
                        if (typeof response.data.cart_subtotal !== 'undefined') {
                            $('.mini_cart_subtotal').html(response.data.cart_subtotal);
                        }
                    } else {
                        alert(response.data || '移除失败');
                    }
                },
                error: function() {
                    alert('网络错误，请重试');
                }
            });
        });
    }

    function fetchMiniCart(done) {
        $.ajax({
            type: 'POST',
            url: (typeof uthr_ajax !== 'undefined' && uthr_ajax.ajax_url)
                ? uthr_ajax.ajax_url
                : (typeof wc_add_to_cart_params !== 'undefined' && wc_add_to_cart_params.ajax_url)
                    ? wc_add_to_cart_params.ajax_url
                    : (typeof woocommerce_params !== 'undefined' && woocommerce_params.ajax_url)
                        ? woocommerce_params.ajax_url
                        : '/wp-admin/admin-ajax.php',
            data: { 
                action: 'uthr_get_mini_cart',
                nonce: (typeof uthr_ajax !== 'undefined' && uthr_ajax.nonce) ? uthr_ajax.nonce : ''
            },
            success: function(response) {
                if (response.success) {
                    if (response.data.items_html) {
                        $('div.mini_cart_items').html(response.data.items_html);
                    }
                    if (typeof response.data.cart_count !== 'undefined') {
                        $('.mini_cart_count').text(response.data.cart_count);
                    }
                    if (typeof response.data.total !== 'undefined') {
                        $('.mini_cart_total').html(response.data.total);
                    }
                    if (typeof response.data.subtotal !== 'undefined') {
                        $('.mini_cart_subtotal').html(response.data.subtotal);
                    }
                }
                if (typeof done === 'function') done();
            },
            error: function() {
                if (typeof done === 'function') done();
            }
        });
    }

    function openMiniCart() {
        $('.mini_cart,.body_overlay').addClass('active');
    }

    function closeMiniCart() {
        $('.mini_cart,.body_overlay').removeClass('active');
    }
    
    // Search Toggle
    function initSearchToggle() {
        $('.search-toggle').on('click', function(e) {
            e.preventDefault();
            $('.search_form_wrapper').addClass('active');
            $('.search_form input').focus();
        });
        
        $('.search_close').on('click', function(e) {
            e.preventDefault();
            $('.search_form_wrapper').removeClass('active');
        });
        
        $('.search_form_wrapper').on('click', function(e) {
            if (e.target === this) {
                $(this).removeClass('active');
            }
        });
    }
    
    // Offcanvas Menu
    function initOffcanvasMenu() {
        $('.offcanvas_toggle').on('click', function(e) {
            e.preventDefault();
            $('.offcanvas_menu').addClass('active');
            $('.body_overlay').addClass('active');
            $('body').addClass('menu-open');
        });
        
        $('.canvas_close a').on('click', function(e) {
            e.preventDefault();
            closeOffcanvasMenu();
        });
        
        $('.body_overlay').on('click', function(e) {
            closeOffcanvasMenu();
        });
        
        function closeOffcanvasMenu() {
            $('.offcanvas_menu').removeClass('active');
            $('.body_overlay').removeClass('active');
            $('body').removeClass('menu-open');
        }
    }
    
    // Product Actions
    function initProductActions() {
        // Wishlist Toggle
        $('.wishlist').on('click', function(e) {
            e.preventDefault();
            var $this = $(this);
            var productId = $this.data('product-id');
            
            // Toggle wishlist class
            $this.toggleClass('active');
            
            // Add to wishlist functionality
            if ($this.hasClass('active')) {
                // Add to wishlist
                console.log('Added to wishlist:', productId);
            } else {
                // Remove from wishlist
                console.log('Removed from wishlist:', productId);
            }
        });
        
        // Quick View
        $('.quick_view').on('click', function(e) {
            e.preventDefault();
            var productId = $(this).data('product-id');
            
            // Open quick view modal
            console.log('Quick view for product:', productId);
        });
        
        // Product Image Hover Effect
        $('.product_thumb').hover(
            function() {
                $(this).find('.product_action').stop().animate({
                    opacity: 1,
                    top: '15px'
                }, 200);
            },
            function() {
                $(this).find('.product_action').stop().animate({
                    opacity: 0,
                    top: '5px'
                }, 200);
            }
        );
    }
    
    // Slick Sliders
    function initSlickSliders() {
        // Main Slider
        if ($('.slick_slider_activation').length) {
            $('.slick_slider_activation').slick({
                slidesToShow: 1,
                slidesToScroll: 1,
                arrows: true,
                dots: true,
                autoplay: true,
                autoplaySpeed: 5000,
                speed: 1000,
                infinite: true,
                fade: true,
                prevArrow: '<button class="prev_arrow"><i class="icon-arrow-left icons"></i></button>',
                nextArrow: '<button class="next_arrow"><i class="icon-arrow-right icons"></i></button>',
                responsive: [
                    {
                        breakpoint: 768,
                        settings: {
                            arrows: false,
                            dots: true
                        }
                    }
                ]
            });
        }
        
        // Product Thumbnail Slider
        if ($('.product_thumb_nav').length) {
            $('.product_thumb_nav').slick({
                slidesToShow: 4,
                slidesToScroll: 1,
                arrows: false,
                dots: false,
                infinite: true,
                responsive: [
                    {
                        breakpoint: 768,
                        settings: {
                            slidesToShow: 3
                        }
                    },
                    {
                        breakpoint: 480,
                        settings: {
                            slidesToShow: 2
                        }
                    }
                ]
            });
        }
    }
    
    // WOW Animations
    function initWOWAnimations() {
        if (typeof WOW !== 'undefined') {
            new WOW().init();
        }
    }
    
    // Sticky Header
    function initStickyHeader() {
        var $header = $('.header_section');
        
        function updateStickyHeader() {
            var scrollTop = $(window).scrollTop();
            var headerHeight = $header.outerHeight();
            
            if (scrollTop > 100) {
                if (!$header.hasClass('header_sticky')) {
                    $header.addClass('header_sticky');
                }
                $('body').css('padding-top', headerHeight + 'px');
            } else {
                if ($header.hasClass('header_sticky')) {
                    $header.removeClass('header_sticky');
                }
                $('body').css('padding-top', '0');
            }
        }
        
        // 初始检查
        updateStickyHeader();
        
        // 滚动事件
        $(window).on('scroll', function() {
            updateStickyHeader();
        });
        
        // 窗口resize时重新计算
        $(window).on('resize', function() {
            var headerHeight = $header.outerHeight();
            
            if ($header.hasClass('header_sticky')) {
                $('body').css('padding-top', headerHeight + 'px');
            }
        });
    }
    
    // Background Image Handler
    function dataBackgroundImage() {
        $('[data-bgimg]').each(function() {
            var bgImgUrl = $(this).data('bgimg');
            $(this).css({
                'background-image': 'url(' + bgImgUrl + ')',
                'background-size': 'cover',
                'background-position': 'center',
                'background-repeat': 'no-repeat'
            });
        });
    }
    
    // Window Load
    $(window).on('load', function() {
        dataBackgroundImage();
    });
    
    // Window Resize
    $(window).on('resize', function() {
        // Recalculate sticky header
        var $header = $('.header_section');
        var headerHeight = $header.outerHeight();
        
        if ($header.hasClass('header_sticky')) {
            $('body').css('padding-top', headerHeight + 'px');
        }
    });
    
    // // 初始化支付方式处理（仅checkout页面）
    // function initCheckoutPaymentMethods() {
    //     if (!$('body').hasClass('woocommerce-checkout')) {
    //         return;
    //     }
        
    //     // 确保不拦截WooCommerce的正常表单提交流程
    //     // WooCommerce使用自己的AJAX处理checkout提交
        
    //     // 监听支付方式选择变化
    //     // WooCommerce会触发payment_method_selected事件，我们监听它以确保UI正确更新
    //     $(document.body).on('change', 'input[name="payment_method"]', function() {
    //         var $selectedMethod = $(this);
    //         var methodId = $selectedMethod.val();
            
    //         // 隐藏所有支付面板
    //         $('.payment_box').hide();
            
    //         // 显示选中的支付面板
    //         var $paymentPanel = $('#payment_method_' + methodId + '_panel');
    //         if ($paymentPanel.length) {
    //             $paymentPanel.show();
    //         }
    //     });
        
    //     // 监听WooCommerce的标准支付方式选择事件
    //     $(document.body).on('payment_method_selected', function() {
    //         // WooCommerce已经处理了显示/隐藏，但我们确保UI正确
    //         var $selectedMethod = $('input[name="payment_method"]:checked');
    //         if ($selectedMethod.length) {
    //             var methodId = $selectedMethod.val();
    //             var $paymentPanel = $('#payment_method_' + methodId + '_panel');
    //             if ($paymentPanel.length) {
    //                 $paymentPanel.show();
    //             }
    //         }
    //     });
        
    //     // 初始化时显示默认选中的支付方式面板
    //     setTimeout(function() {
    //         var $selectedMethod = $('input[name="payment_method"]:checked');
    //         if ($selectedMethod.length) {
    //             var methodId = $selectedMethod.val();
    //             var $paymentPanel = $('#payment_method_' + methodId + '_panel');
    //             if ($paymentPanel.length) {
    //                 $paymentPanel.show();
    //             }
    //         }
    //     }, 300);
        
    //     // 监听WooCommerce的checkout更新事件
    //     $(document.body).on('updated_checkout', function() {
    //         // 当checkout更新时，确保选中的支付方式面板显示
    //         setTimeout(function() {
    //             var $selectedMethod = $('input[name="payment_method"]:checked');
    //             if ($selectedMethod.length) {
    //                 var methodId = $selectedMethod.val();
    //                 var $paymentPanel = $('#payment_method_' + methodId + '_panel');
    //                 if ($paymentPanel.length) {
    //                     $paymentPanel.show();
    //                 }
    //             }
    //         }, 100);
    //     });
        
    //     // 确保WooCommerce的checkout脚本已正确初始化
    //     // 检查checkout脚本是否已加载
    //     if (typeof wc_checkout_params === 'undefined') {
    //         console.warn('WooCommerce checkout script may not be loaded');
    //     }
        
    //     // 确保表单action正确（应为空或当前URL，让WooCommerce处理）
    //     var $checkoutForm = $('form.checkout');
    //     if ($checkoutForm.length) {
    //         var currentAction = $checkoutForm.attr('action') || '';
    //         // 如果action包含page_id，修复它为空字符串
    //         if (currentAction.indexOf('page_id=') !== -1) {
    //             $checkoutForm.attr('action', '');
    //         }
    //     }
        
    //     // 强制使用自定义checkout处理
    //     var $form = $('form.checkout');
    //     if (!$form.length) {
    //         console.warn('Checkout form not found');
    //         return;
    //     }
        
    //     console.log('Initializing custom checkout handler');
        
    //     // 直接拦截表单提交和按钮点击
    //     var handleCheckout = function(e) {
    //         e.preventDefault();
    //         e.stopPropagation();
    //         e.stopImmediatePropagation();
            
    //         console.log('Checkout button clicked, handling with custom AJAX');
            
    //         var $button = e.type === 'click' ? $(this) : $form.find('#place_order');
    //         var $form = $('form.checkout');
            
    //         if (!$form.length) {
    //             console.error('Form not found');
    //             return false;
    //         }
            
    //         // 禁用按钮防止重复提交
    //         $button.prop('disabled', true);
    //         var originalText = $button.text();
    //         $button.text('处理中...');
            
    //         // 手动收集所有表单数据，确保所有字段都被包含
    //         var formDataArray = [];
            
    //         // 先尝试使用jQuery的serialize（它应该能处理大部分情况）
    //         var serializedData = $form.serialize();
    //         if (serializedData) {
    //             // 解析serialize的结果
    //             serializedData.split('&').forEach(function(pair) {
    //                 if (pair) {
    //                     formDataArray.push(pair);
    //                 }
    //             });
    //         }
            
    //         // 然后手动补充任何遗漏的字段（双重保险）
    //         // 收集所有input、select、textarea字段（包括嵌套的）
    //         $form.find('input, select, textarea').each(function() {
    //             var $field = $(this);
    //             var name = $field.attr('name');
    //             var type = $field.attr('type') || '';
    //             var tagName = $field.prop('tagName').toLowerCase();
                
    //             // 跳过没有name的字段
    //             if (!name || name === '') {
    //                 return;
    //             }
                
    //             // 跳过按钮和提交按钮
    //             if (type === 'button' || type === 'submit' || type === 'reset') {
    //                 return;
    //             }
                
    //             // 检查这个字段是否已经在formDataArray中
    //             var alreadyIncluded = false;
    //             for (var i = 0; i < formDataArray.length; i++) {
    //                 if (formDataArray[i].indexOf(encodeURIComponent(name) + '=') === 0) {
    //                     alreadyIncluded = true;
    //                     break;
    //                 }
    //             }
                
    //             if (alreadyIncluded) {
    //                 return; // 已经包含，跳过
    //             }
                
    //             // 跳过禁用的字段（但保留hidden字段）
    //             if ($field.prop('disabled') && type !== 'hidden') {
    //                 return;
    //             }
                
    //             var value = '';
                
    //             // 处理不同类型的字段
    //             if (type === 'checkbox' || type === 'radio') {
    //                 // checkbox和radio：只有checked的才包含
    //                 if ($field.is(':checked')) {
    //                     value = $field.val() || '';
    //                     formDataArray.push(encodeURIComponent(name) + '=' + encodeURIComponent(value));
    //                 }
    //             } else if (tagName === 'select') {
    //                 // select：获取选中的值
    //                 value = $field.val();
    //                 if (value !== null && value !== undefined && value !== '') {
    //                     if (Array.isArray(value)) {
    //                         // 多选select
    //                         value.forEach(function(v) {
    //                             formDataArray.push(encodeURIComponent(name) + '=' + encodeURIComponent(v));
    //                         });
    //                     } else {
    //                         formDataArray.push(encodeURIComponent(name) + '=' + encodeURIComponent(value));
    //                     }
    //                 }
    //             } else {
    //                 // input和textarea：获取值（包括空值）
    //                 value = $field.val();
    //                 if (value !== null && value !== undefined) {
    //                     // 即使是空字符串也包含（因为WooCommerce可能需要）
    //                     formDataArray.push(encodeURIComponent(name) + '=' + encodeURIComponent(value));
    //                 }
    //             }
    //         });
            
    //         // 组合表单数据
    //         var formData = formDataArray.join('&');
            
    //         // 确保包含必要的字段
    //         if (formData.indexOf('woocommerce_checkout_place_order') === -1) {
    //             formData += '&woocommerce_checkout_place_order=1';
    //         }
            
    //         // 调试：检查是否收集到了billing字段
    //         console.log('Form data collected:', formDataArray.length, 'fields');
    //         console.log('Has billing_email:', formData.indexOf('billing_email') !== -1);
    //         console.log('Has billing_first_name:', formData.indexOf('billing_first_name') !== -1);
            
    //         // 列出所有收集到的字段名（用于调试）
    //         var fieldNames = [];
    //         formDataArray.forEach(function(pair) {
    //             var name = pair.split('=')[0];
    //             if (name && name.indexOf('billing') !== -1) {
    //                 fieldNames.push(decodeURIComponent(name));
    //             }
    //         });
    //         console.log('Billing fields found:', fieldNames);
            
    //         // 如果form内没有找到billing字段，尝试从整个页面收集（可能字段在form外）
    //         if (formData.indexOf('billing_email') === -1) {
    //             console.warn('Billing fields not found in form, trying to collect from entire page...');
                
    //             // 从整个页面收集billing相关字段
    //             $('input[name^="billing_"], select[name^="billing_"], textarea[name^="billing_"]').each(function() {
    //                 var $field = $(this);
    //                 var name = $field.attr('name');
    //                 var type = $field.attr('type') || '';
    //                 var value = $field.val();
                    
    //                 if (!name) return;
                    
    //                 // 检查是否已包含
    //                 var alreadyIncluded = false;
    //                 for (var i = 0; i < formDataArray.length; i++) {
    //                     if (formDataArray[i].indexOf(encodeURIComponent(name) + '=') === 0) {
    //                         alreadyIncluded = true;
    //                         break;
    //                     }
    //                 }
                    
    //                 if (!alreadyIncluded && value !== null && value !== undefined) {
    //                     if (type === 'checkbox' || type === 'radio') {
    //                         if ($field.is(':checked')) {
    //                             formDataArray.push(encodeURIComponent(name) + '=' + encodeURIComponent(value || ''));
    //                         }
    //                     } else {
    //                         formDataArray.push(encodeURIComponent(name) + '=' + encodeURIComponent(value));
    //                     }
    //                 }
    //             });
                
    //             // 重新组合数据
    //             formData = formDataArray.join('&');
                
    //             console.log('After page-wide collection, billing_email found:', formData.indexOf('billing_email') !== -1);
    //         }
            
    //         // 获取nonce
    //         var nonce = $form.find('input[name="woocommerce-process-checkout-nonce"]').val();
    //         if (!nonce) {
    //             console.error('Checkout nonce not found');
    //             alert('表单验证失败，请刷新页面重试');
    //             $button.prop('disabled', false).text(originalText);
    //             return false;
    //         }
            
    //         // 使用自定义AJAX端点
    //         var ajaxUrl = (typeof uthr_ajax !== 'undefined' && uthr_ajax.ajax_url) 
    //             ? uthr_ajax.ajax_url 
    //             : '/wp-admin/admin-ajax.php';
            
    //         console.log('=== CUSTOM CHECKOUT AJAX ===');
    //         console.log('URL:', ajaxUrl);
    //         console.log('Action: custom_checkout');
    //         console.log('Form data length:', formData.length);
            
    //         // 发送AJAX请求
    //         $.ajax({
    //             type: 'POST',
    //             url: ajaxUrl,
    //             data: formData + '&action=custom_checkout',
    //             dataType: 'json',
    //             timeout: 30000,
    //             success: function(response) {
    //                 console.log('=== AJAX SUCCESS ===');
    //                 console.log('Response:', response);
    //                 console.log('Response type:', typeof response);
    //                 console.log('Response keys:', Object.keys(response || {}));
                    
    //                 // 检查响应格式
    //                 // 可能是WooCommerce格式 {result: "failure", messages: "..."}
    //                 // 或者我们的格式 {success: false, data: {message: "..."}}
    //                 if (response.result === 'failure') {
    //                     // 这是WooCommerce的标准错误格式
    //                     console.error('Received WooCommerce error format:', response);
    //                     var errorMsg = '订单处理失败';
    //                     if (response.messages) {
    //                         // 尝试从HTML中提取文本
    //                         var $temp = $('<div>').html(response.messages);
    //                         errorMsg = $temp.text() || response.messages;
    //                         // 清理HTML标签
    //                         errorMsg = errorMsg.replace(/<[^>]*>/g, '').trim();
    //                     }
    //                     $form.prepend('<div class="woocommerce-error">' + errorMsg + '</div>');
    //                     $button.prop('disabled', false).text(originalText);
                        
    //                     // 滚动到错误消息
    //                     setTimeout(function() {
    //                         $('html, body').animate({
    //                             scrollTop: $('.woocommerce-error').first().offset().top - 100
    //                         }, 500);
    //                     }, 100);
    //                     return;
    //                 }
                    
    //                 if (response.success) {
    //                     // 订单创建成功
    //                     var message = response.data && response.data.message ? response.data.message : '订单创建成功';
    //                     var redirectUrl = response.data && response.data.redirect ? response.data.redirect : null;
    //                     var orderId = response.data && response.data.order_id ? response.data.order_id : null;
                        
    //                     console.log('Order created successfully. Order ID:', orderId);
                        
    //                     // 显示成功消息
    //                     $form.prepend('<div class="woocommerce-message">' + message + (orderId ? ' (订单号: ' + orderId + ')' : '') + '</div>');
                        
    //                     // 如果有重定向URL，跳转
    //                     if (redirectUrl) {
    //                         console.log('Redirecting to:', redirectUrl);
    //                         setTimeout(function() {
    //                             window.location.href = redirectUrl;
    //                         }, 1000);
    //                     } else {
    //                         // 刷新页面
    //                         console.log('Reloading page');
    //                         setTimeout(function() {
    //                             window.location.reload();
    //                         }, 1500);
    //                     }
    //                 } else {
    //                     // 显示错误
    //                     console.error('Checkout failed:', response);
    //                     var errorMessage = (response.data && response.data.message) ? response.data.message : '订单处理失败，请重试';
                        
    //                     $form.prepend('<div class="woocommerce-error">' + errorMessage + '</div>');
    //                     $button.prop('disabled', false).text(originalText);
                        
    //                     // 滚动到错误消息
    //                     $('html, body').animate({
    //                         scrollTop: $('.woocommerce-error').first().offset().top - 100
    //                     }, 500);
    //                 }
    //             },
    //             error: function(xhr, status, error) {
    //                 console.error('=== AJAX ERROR ===');
    //                 console.error('Status:', status);
    //                 console.error('Error:', error);
    //                 console.error('Response:', xhr.responseText);
                    
    //                 var errorMsg = '订单提交失败，请刷新页面重试';
                    
    //                 // 尝试解析错误响应
    //                 if (xhr.responseJSON) {
    //                     if (xhr.responseJSON.data && xhr.responseJSON.data.message) {
    //                         errorMsg = xhr.responseJSON.data.message;
    //                     } else if (xhr.responseJSON.message) {
    //                         errorMsg = xhr.responseJSON.message;
    //                     }
    //                 } else if (xhr.responseText) {
    //                     try {
    //                         var response = JSON.parse(xhr.responseText);
    //                         if (response.data && response.data.message) {
    //                             errorMsg = response.data.message;
    //                         } else if (response.message) {
    //                             errorMsg = response.message;
    //                         }
    //                     } catch (e) {
    //                         console.error('Failed to parse error response');
    //                     }
    //                 }
                    
    //                 $form.prepend('<div class="woocommerce-error">' + errorMsg + '</div>');
    //                 $button.prop('disabled', false).text(originalText);
                    
    //                 // 滚动到错误消息
    //                 setTimeout(function() {
    //                     $('html, body').animate({
    //                         scrollTop: $('.woocommerce-error').first().offset().top - 100
    //                     }, 500);
    //                 }, 100);
    //             }
    //         });
            
    //         return false;
    //     };
        
    //     // 绑定多个事件以确保捕获
    //     $(document.body).off('click', '#place_order', handleCheckout);
    //     $(document.body).on('click', '#place_order', handleCheckout);
        
    //     // 也拦截表单提交
    //     $form.off('submit', handleCheckout);
    //     $form.on('submit', handleCheckout);
        
    //     console.log('Custom checkout handler initialized');
        
    //     // 监听表单提交事件（作为最后的后备）
    //     $(document.body).on('submit', 'form.checkout', function(e) {
    //         // 如果WooCommerce脚本未加载，我们已经通过按钮点击处理了
    //         // 这里只作为后备，如果按钮点击处理失败
    //         if (typeof wc_checkout_params === 'undefined') {
    //             // 我们已经通过按钮点击处理了，这里不阻止
    //             return true;
    //         }
            
    //         // WooCommerce脚本已加载，让它处理
    //     });
        
    //     // 重要：不要拦截WooCommerce的表单提交
    //     // WooCommerce使用AJAX处理checkout提交，应该让其正常工作
    //     // 不要在这里添加preventDefault()，除非有特殊需求
    // }
    
    // 初始化 Checkout AJAX 处理
    function initCheckoutAjax() {
        // 只在 checkout 页面初始化
        if (!$('body').hasClass('woocommerce-checkout')) {
            return;
        }
        
        var $form = $('form.checkout');
        if (!$form.length) {
            return;
        }
        
        // 先移除 WooCommerce 的默认 checkout 处理（如果存在）
        $(document.body).off('click', '#place_order');
        $form.off('submit.checkout');
        
        // 完全阻止表单的默认提交行为
        $form.on('submit', function(e) {
            e.preventDefault();
            e.stopImmediatePropagation();
            return false;
        });
        
        // 处理 checkout 按钮点击 - 使用立即执行函数确保优先级
        $(document.body).on('click', '#place_order', function(e) {
            e.preventDefault();
            e.stopImmediatePropagation(); // 阻止其他事件监听器
            e.stopPropagation(); // 阻止事件冒泡
            
            var $button = $(this);

            
            // 禁用按钮防止重复提交
            if ($button.prop('disabled')) {
                return false;
            }
            
            $button.prop('disabled', true);
            var originalText = $button.text();
            $button.text('处理中...');
            
            // 清除之前的错误消息
            $form.find('.woocommerce-error, .woocommerce-message').remove();
            
            // 收集表单数据
            var formData = $form.serialize();
            
            // 确保支付方式被包含（如果未选择，尝试获取默认选中的）
            var paymentMethod = $form.find('input[name="payment_method"]:checked').val();
            if (!paymentMethod) {
                // 如果没有选中的支付方式，尝试获取第一个可用的
                paymentMethod = $form.find('input[name="payment_method"]').first().val();
            }
            
            if (!paymentMethod) {
                alert('请选择支付方式');
                $button.prop('disabled', false).text(originalText);
                return false;
            }
            
            // 获取 nonce
            var nonce = $form.find('input[name="woocommerce-process-checkout-nonce"]').val();
            if (!nonce) {
                alert('表单验证失败，请刷新页面重试');
                $button.prop('disabled', false).text(originalText);
                return false;
            }
            
            // 获取 AJAX URL
            var ajaxUrl = (typeof uthr_ajax !== 'undefined' && uthr_ajax.ajax_url)
                ? uthr_ajax.ajax_url
                : (typeof wc_add_to_cart_params !== 'undefined' && wc_add_to_cart_params.ajax_url)
                    ? wc_add_to_cart_params.ajax_url
                    : '/wp-admin/admin-ajax.php';
            
            // 准备 AJAX 数据 - 移除所有可能触发 WooCommerce 处理的字段
            // 移除 action、woocommerce_checkout_place_order 等字段
            var ajaxData = formData
                .replace(/&?action=[^&]*/g, '')  // 移除 action
                .replace(/&?woocommerce_checkout_place_order=[^&]*/g, '');  // 移除这个字段
            
            // 确保支付方式在数据中
            if (ajaxData.indexOf('payment_method=') === -1) {
                ajaxData += '&payment_method=' + encodeURIComponent(paymentMethod);
            }
            
            // 最后添加我们的 action - 确保它是唯一的 action
            ajaxData += '&action=custom_checkout';
            
            // 调试：输出完整的数据
            console.log('AJAX Data to send:', ajaxData);
            console.log('Action check:', ajaxData.indexOf('action=custom_checkout') !== -1 ? '✓ custom_checkout found' : '✗ custom_checkout NOT found');
            
            // 发送 AJAX 请求
            $.ajax({
                type: 'POST',
                url: ajaxUrl,
                data: ajaxData,
                dataType: 'json',
                timeout: 30000,
                beforeSend: function(xhr) {
                    // 调试：检查发送的数据
                    console.log('Before send - URL:', ajaxUrl);
                    console.log('Before send - Action:', ajaxData.indexOf('action=custom_checkout') !== -1 ? 'custom_checkout' : 'unknown');
                },
                success: function(response) {
                    // 检查响应格式
                    if (response.success !== undefined && response.data) {
                        // 这是我们的自定义响应格式
                        alert('Custom checkout success: ' + response.data.message);
                        console.log('Custom checkout response:', response);
                    } else if (response.result !== undefined) {
                        // 这是 WooCommerce 的响应格式
                        console.error('WooCommerce response intercepted:', response);
                        alert('WooCommerce error: ' + (response.messages || 'Unknown error'));
                    } else {
                        console.log('Unknown response format:', response);
                        alert('Response: ' + JSON.stringify(response));
                    }
                    // // 检查响应格式
                    // // WooCommerce 标准错误格式: {result: "failure", messages: "..."}
                    // // 我们的格式: {success: true/false, data: {...}}
                    // if (response.result === 'failure') {
                    //     // WooCommerce 标准错误格式
                    //     var errorMsg = '订单处理失败';
                    //     if (response.messages) {
                    //         // 尝试从HTML中提取文本
                    //         var $temp = $('<div>').html(response.messages);
                    //         var errorText = $temp.text() || response.messages;
                    //         // 清理HTML标签和多余空白
                    //         errorText = errorText.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
                            
                    //         // 如果错误消息重复，只显示一次
                    //         var uniqueErrors = [];
                    //         var seenErrors = {};
                    //         errorText.split(/\s+/).forEach(function(word) {
                    //             if (word.length > 3 && !seenErrors[word]) {
                    //                 uniqueErrors.push(word);
                    //                 seenErrors[word] = true;
                    //             }
                    //         });
                            
                    //         if (uniqueErrors.length > 0) {
                    //             // 提取完整的错误消息
                    //             var errorLines = errorText.split(/Invalid payment method/);
                    //             if (errorLines.length > 1) {
                    //                 errorMsg = 'Invalid payment method. Please select a valid payment method.';
                    //             } else {
                    //                 errorMsg = errorText;
                    //             }
                    //         } else {
                    //             errorMsg = errorText || '订单处理失败';
                    //         }
                    //     }
                        
                    //     // 显示错误消息（使用WooCommerce格式）
                    //     if (response.messages) {
                    //         $form.prepend('<div class="woocommerce-error" role="alert">' + response.messages + '</div>');
                    //     } else {
                    //         $form.prepend('<div class="woocommerce-error" role="alert">' + errorMsg + '</div>');
                    //     }
                    //     $button.prop('disabled', false).text(originalText);
                        
                    //     // 滚动到错误消息
                    //     setTimeout(function() {
                    //         var $errorElement = $('.woocommerce-error').first();
                    //         if ($errorElement.length) {
                    //             $('html, body').animate({
                    //                 scrollTop: $errorElement.offset().top - 100
                    //             }, 500);
                    //         }
                    //     }, 100);
                    //     return;
                    // }
                    
                    // if (response.success) {
                    //     // 订单创建成功
                    //     var message = (response.data && response.data.message) ? response.data.message : '订单创建成功';
                    //     var redirectUrl = (response.data && response.data.redirect) ? response.data.redirect : null;
                    //     var orderId = (response.data && response.data.order_id) ? response.data.order_id : null;
                        
                    //     // 显示成功消息
                    //     $form.prepend('<div class="woocommerce-message">' + message + (orderId ? ' (订单号: ' + orderId + ')' : '') + '</div>');
                        
                    //     // 如果有重定向 URL，跳转
                    //     if (redirectUrl) {
                    //         setTimeout(function() {
                    //             window.location.href = redirectUrl;
                    //         }, 1000);
                    //     } else {
                    //         // 刷新页面
                    //         setTimeout(function() {
                    //             window.location.reload();
                    //         }, 1500);
                    //     }
                    // } else {
                    //     // 显示错误
                    //     var errorMessage = (response.data && response.data.message) ? response.data.message : '订单处理失败，请重试';
                        
                    //     $form.prepend('<div class="woocommerce-error">' + errorMessage + '</div>');
                    //     $button.prop('disabled', false).text(originalText);
                        
                    //     // 滚动到错误消息
                    //     setTimeout(function() {
                    //         $('html, body').animate({
                    //             scrollTop: $('.woocommerce-error').first().offset().top - 100
                    //         }, 500);
                    //     }, 100);
                    // }
                },
                error: function(xhr, status, error) {
                    var errorMsg = '订单提交失败，请刷新页面重试';
                    
                    // 尝试解析错误响应
                    if (xhr.responseJSON) {
                        if (xhr.responseJSON.data && xhr.responseJSON.data.message) {
                            errorMsg = xhr.responseJSON.data.message;
                        } else if (xhr.responseJSON.message) {
                            errorMsg = xhr.responseJSON.message;
                        }
                    } else if (xhr.responseText) {
                        try {
                            var response = JSON.parse(xhr.responseText);
                            if (response.data && response.data.message) {
                                errorMsg = response.data.message;
                            } else if (response.message) {
                                errorMsg = response.message;
                            }
                        } catch (e) {
                            // 解析失败，使用默认消息
                        }
                    }
                    
                    $form.prepend('<div class="woocommerce-error">' + errorMsg + '</div>');
                    $button.prop('disabled', false).text(originalText);
                    
                    // 滚动到错误消息
                    setTimeout(function() {
                        $('html, body').animate({
                            scrollTop: $('.woocommerce-error').first().offset().top - 100
                        }, 500);
                    }, 100);
                }
            });
            
            return false;
        });
        
        // 阻止表单的默认提交行为
        $form.on('submit', function(e) {
            e.preventDefault();
            // 触发按钮点击事件
            $('#place_order').trigger('click');
            return false;
        });
    }
    
    // 初始化变体选择器
    function initVariationSelector() {
        // 获取变体商品数据（如果有）
        var $variationForm = $('.product_variant');
        if (!$variationForm.length) return;
        
        // 处理颜色选择（radio button）
        $(document).on('change', '.variation-options.color-options input[type="radio"]', function() {
            var $input = $(this);
            var $listItem = $input.closest('li');
            // 移除其他选中状态
            $input.closest('ul').find('li').removeClass('active');
            $listItem.addClass('active');
            updateVariationSelection();
        });
        
        // 处理尺寸等其他属性选择（链接点击）
        $(document).on('click', '.variation-options a.variation-option', function(e) {
            e.preventDefault();
            var $link = $(this);
            var $listItem = $link.closest('li');
            // 移除同一组其他选中状态
            $link.closest('ul').find('li').removeClass('active');
            $listItem.addClass('active');
            updateVariationSelection();
        });
        
        // 更新变体选择
        function updateVariationSelection() {
            var selectedAttributes = {};
            var allSelected = true;
            
            // 收集所有选中的属性
            $('.variation-options').each(function() {
                var $optionGroup = $(this);
                var $selected = $optionGroup.find('li.active');
                
                if ($selected.length) {
                    var attributeName = $selected.find('[data-attribute_name]').data('attribute_name') || 
                                       $selected.find('input').attr('name') ||
                                       $selected.find('.variation-option').data('attribute_name');
                    var value = $selected.find('input').val() || 
                               $selected.find('.variation-option').data('value') ||
                               $selected.find('.variation-option').text().trim();
                    
                    if (attributeName && value) {
                        // 移除 attribute_ 前缀（如果有）
                        var cleanName = attributeName.replace(/^attribute_/, '');
                        selectedAttributes[cleanName] = value;
                    }
                } else {
                    allSelected = false;
                }
            });
            
            // 如果有变体商品数据，尝试找到匹配的变体
            if (allSelected && Object.keys(selectedAttributes).length > 0) {
                findMatchingVariation(selectedAttributes);
            } else {
                // 重置变体ID
                $('.variation_id').val(0);
            }
        }
        
        // 查找匹配的变体（需要WooCommerce变体数据）
        function findMatchingVariation(attributes) {
            var productId = $('.custom-add-to-cart').data('product-id');
            if (!productId) return;
            
            // 首先尝试从全局变量中获取变体数据
            var variations = null;
            if (typeof window.uthrProductVariations !== 'undefined' && window.uthrProductVariations[productId]) {
                variations = window.uthrProductVariations[productId];
            }
            
            // 如果全局变量没有，尝试从表单数据获取
            if (!variations) {
                var $form = $('.variations_form');
                if ($form.length) {
                    variations = $form.data('product_variations');
                }
            }
            
            // 查找匹配的变体
            if (variations && Array.isArray(variations)) {
                for (var i = 0; i < variations.length; i++) {
                    var variation = variations[i];
                    var attributesMatch = true;
                    
                    // 检查所有属性是否匹配
                    for (var attrName in attributes) {
                        var attrKey = 'attribute_pa_' + attrName.replace('pa_', ''); // WooCommerce使用 attribute_pa_ 前缀
                        var attrKeyAlt = 'attribute_' + attrName;
                        
                        var variationAttr = variation.attributes && (variation.attributes[attrKey] || variation.attributes[attrKeyAlt]);
                        var selectedValue = attributes[attrName];
                        
                        // 兼容不同的属性格式
                        if (variationAttr && variationAttr !== selectedValue && variationAttr !== '') {
                            attributesMatch = false;
                            break;
                        }
                    }
                    
                    if (attributesMatch && variation.variation_id) {
                        $('.variation_id').val(variation.variation_id);
                        // 触发WooCommerce的变体找到事件
                        $('body').trigger('found_variation', [variation]);
                        return;
                    }
                }
            }
            
            // 如果找不到，使用AJAX查询
            $.ajax({
                url: (typeof uthr_ajax !== 'undefined' && uthr_ajax.ajax_url)
                    ? uthr_ajax.ajax_url
                    : '/wp-admin/admin-ajax.php',
                type: 'POST',
                data: {
                    action: 'find_variation_id',
                    product_id: productId,
                    attributes: attributes
                },
                success: function(response) {
                    if (response.success && response.data.variation_id) {
                        $('.variation_id').val(response.data.variation_id);
                    }
                }
            });
        }
    }



    










    
})(jQuery);

