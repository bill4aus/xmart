
class woocart {
    constructor() {
        this.storageKey = 'kitpayment_cart';
    }

    // Get cart data object
    getCart() {
        let cart = localStorage.getItem(this.storageKey);
        try {
            cart = cart ? JSON.parse(cart) : [];
            if (!Array.isArray(cart)) cart = [];
        } catch (e) {
            cart = [];
        }
        return cart;
    }

    // Save cart data object
    setCart(cart) {
        localStorage.setItem(this.storageKey, JSON.stringify(cart));
    }

    // Add product (if exists, accumulate quantity)
    add(product_id, quantity = 1, productInfo = {}) {
        if (!product_id) return;
        quantity = Number(quantity);
        if (!quantity || quantity < 1) quantity = 1;

        // Ensure price is in number format
        if (productInfo.price) {
            if (typeof productInfo.price === 'string') {
                productInfo.price = parseFloat(productInfo.price.replace(/[^\d.,-]/g, '').replace(',', '.')) || 0;
            } else if (typeof productInfo.price !== 'number') {
                productInfo.price = parseFloat(productInfo.price) || 0;
            }
        }

        let cart = this.getCart();
        let found = cart.find(item => item.id == product_id);

        // 获取默认图片URL（仅在 productInfo.image 不存在时使用）
        let imgurl = $('.product_details .product_zoom_main_img .product_zoom_thumb img').attr('src');
        // Ensure product basic info fields exist
        // 优先使用传入的 productInfo，如果没有则使用默认值
        productInfo = Object.assign({
            name: '',
            price: 0,
            image: '', // 先设为空，后面再判断
            permalink: ''
        }, productInfo || {});
        
        // 如果 productInfo.image 为空，才使用从页面获取的图片
        if (!productInfo.image && imgurl) {
            productInfo.image = imgurl;
        }

        if (found) {
            
            found.quantity += quantity;
            // If new product info is passed, update product info (avoid outdated info)
            if (productInfo && Object.keys(productInfo).length > 0) {
                // Ensure price is a number
                if (productInfo.price) {
                    found.price = typeof productInfo.price === 'number' ? productInfo.price : parseFloat(productInfo.price) || found.price || 0;
                }
                Object.assign(found, productInfo);
            }
        } else {
            let item = Object.assign({
                id: product_id,
                quantity: quantity,
                name: '',
                price: 0,
                image: imgurl, // Thumbnail URL
                permalink: ''
            }, productInfo || {});
            // Ensure price is a number
            if (typeof item.price !== 'number') {
                item.price = parseFloat(item.price) || 0;
            }
            cart.push(item);
        }
        
        // console.log(found,imgurl,productInfo)

        this.setCart(cart);
        // alert('add success');
    }

    // Remove product
    remove(product_id) {
        let cart = this.getCart().filter(item => item.id != product_id);
        this.setCart(cart);
    }

    // Update product quantity
    update(product_id, quantity) {
        quantity = Number(quantity);
        let cart = this.getCart();
        let found = cart.find(item => item.id == product_id);
        if (found) {
            if (quantity < 1) {
                // Remove this item
                cart = cart.filter(item => item.id != product_id);
            } else {
                found.quantity = quantity;
            }
            this.setCart(cart);
        }
    }

    // Clear cart
    clear() {
        localStorage.removeItem(this.storageKey);
    }

    // Get all products (array)
    getItems() {
        return this.getCart();
    }

    // Get total number of products (product types count)
    getCount() {
        return this.getCart().length;
    }

    // Get total quantity (sum of all quantities)
    getTotalQuantity() {
        return this.getCart().reduce((sum, item) => sum + (item.quantity || 0), 0);
    }

    // Get cart total amount {total, currency}
    getTotalPrice() {
        return this.getCart().reduce((sum, item) => {
            // Ensure price is in number format
            let price = 0;
            if (typeof item.price === 'number') {
                price = item.price;
            } else if (typeof item.price === 'string') {
                // Remove currency symbols and non-numeric characters, keep only numbers and decimal point
                price = parseFloat(item.price.replace(/[^\d.,-]/g, '').replace(',', '.')) || 0;
            } else {
                price = parseFloat(item.price) || 0;
            }
            let quantity = Number(item.quantity) || 1;
            return sum + (price * quantity);
        }, 0);
    }
    
    // Format price display
    formatPrice(price) {
        if (typeof price !== 'number') {
            price = parseFloat(price) || 0;
        }
        // Get currency symbol (if global variable exists)
        var currencySymbol = '';
        if (typeof window.kitpaymentData !== 'undefined' && window.kitpaymentData.currencySymbol) {
            currencySymbol = window.kitpaymentData.currencySymbol;
        } else if (typeof window.kitpaymentProductData !== 'undefined' && window.kitpaymentProductData.currencySymbol) {
            currencySymbol = window.kitpaymentProductData.currencySymbol;
        } else {
            currencySymbol = '$'; // Default to dollar sign
        }
        return currencySymbol + price.toFixed(2);
    }
}

(function($) {
    'use strict';

    var stripeInstance = null;
    var stripeElements = null;
    var stripeCardElement = null;
    var stripeCardMounted = false;
    var stripeJsLoadingPromise = null;

    var stripeCardStyle = {
        base: {
            color: '#32325d',
            fontFamily: '"Helvetica Neue", Helvetica, sans-serif',
            fontSmoothing: 'antialiased',
            fontSize: '16px',
            '::placeholder': {
                color: '#a0aec0'
            }
        },
        invalid: {
            color: '#fa755a',
            iconColor: '#fa755a'
        }
    };

    function getCurrencyCode() {
        if (typeof kitpaymentData !== 'undefined' && kitpaymentData.currencyCode) {
            return kitpaymentData.currencyCode;
        }
        if (typeof window.kitpaymentProductData !== 'undefined' && window.kitpaymentProductData.currencyCode) {
            return window.kitpaymentProductData.currencyCode;
        }
        return 'usd';
    }

    function getCurrencySymbol() {
        if (typeof kitpaymentData !== 'undefined' && kitpaymentData.currencySymbol) {
            return kitpaymentData.currencySymbol;
        }
        if (typeof window.kitpaymentProductData !== 'undefined' && window.kitpaymentProductData.currencySymbol) {
            return window.kitpaymentProductData.currencySymbol;
        }
        return '¥';
    }

    function formatPriceHtml(price) {
        var currencySymbol = getCurrencySymbol();
        var amount = typeof price === 'number' ? price : parseFloat(price) || 0;
        return `<span class="woocommerce-Price-amount amount"><bdi><span class="woocommerce-Price-currencySymbol">${currencySymbol}</span>${amount.toFixed(2)}</bdi></span>`;
    }

    function getPlaceholderImage() {
        // if (typeof window.woopayProductData !== 'undefined' && window.woopayProductData.image) {
        //     return window.woopayProductData.image;
        // }
        // return 'https://via.placeholder.com/300x300?text=Product';

        let imgurl = $('.product_details .product_zoom_main_img .product_zoom_thumb img').attr('src');
        return imgurl;
    }

    function renderCartItemsHTML(items) {
        if (!items || !items.length) {
            return '<div class="mini_cart_empty">cart is empty</div>';
        }

        console.log(items)
        console.log(getPlaceholderImage())

        return items.map(function(item) {
            var name = item.name || ('Product #' + item.id);
            var permalink = item.permalink || '#';
            // 优先使用 item.image，如果没有则使用占位图
            var image = item.image || getPlaceholderImage();
            var quantity = Number(item.quantity) || 1;
            var price = typeof item.price === 'number' ? item.price : parseFloat(item.price) || 0;
            var itemTotal = price * quantity;
            
            // 如果有变量属性字符串，确保显示在商品名称中
            if (item.variation_attributes_string && name.indexOf(item.variation_attributes_string) === -1) {
                name = name + ' - ' + item.variation_attributes_string;
            } else if (item.variation_name && name.indexOf(item.variation_name) === -1) {
                name = name + ' - ' + item.variation_name;
            }
            
            return `
                <div class="cart_item" data-cart-item-key="${item.id || ''}" data-product-id="${item.id}">
                    <div class="cart_img">
                        <a href="${permalink}">
                            <img src="${image}" alt="">
                        </a>
                    </div>
                    <div class="cart_info">
                        <a href="${permalink}">${name}</a>
                        <p><span>${formatPriceHtml(price)}</span></p>
                        <div class="cart_quantity_controls">
                            <button type="button" class="cart_qty_minus" data-product-id="${item.id}" aria-label="decrease quantity">-</button>
                            <span class="cart_qty_display">${quantity}</span>
                            <button type="button" class="cart_qty_plus" data-product-id="${item.id}" aria-label="increase quantity">+</button>
                        </div>
                        <div class="cart_item_total">subtotal: ${formatPriceHtml(itemTotal)}</div>
                    </div>
                    <div class="cart_remove">
                        <a href="javascript:void(0)" class="remove_cart_item" data-cart-item-id="${item.id}" data-cart-item-key="${item.id}" onclick="return false;">
                            <i class="icon-close icons"></i>
                        </a>
                    </div>
                </div>
            `;
        }).join('');
    }

    function updateMiniCartUI() {
        var items = mycart.getItems();
        var totalPrice = mycart.getTotalPrice();
        var formattedTotal = mycart.formatPrice(totalPrice);
        var itemsHtml = renderCartItemsHTML(items);

        $('.mini_cart_count').text(mycart.getTotalQuantity());
        $('.mini_cart_items').html(itemsHtml);
        $('.mini_cart_popup_content_items').html(itemsHtml);

        // Don't modify value, directly overwrite, because we don't need subtotal, just show total
        // $('.mini_cart_total, .mini_cart_table .total, .mini_cart_popup_content_total').html(formattedTotal);
        $('.mini_cart_table').html(`
            <div class="cart_table_border">
            
            <div class="cart_total">
                <span>total:</span>
                <span class="price mini_cart_total">${formattedTotal}</span>
            </div>
        </div>
        `);
    }

    function loadStripeJs(publishableKey) {
        if (!publishableKey) {
            return Promise.reject(new Error('Stripe publishable key is not configured. Please fill in the kitPayment settings page.'));
        }

        if (stripeInstance) {
            return Promise.resolve(stripeInstance);
        }

        if (!stripeJsLoadingPromise) {
            stripeJsLoadingPromise = new Promise(function(resolve, reject) {
                if (window.Stripe) {
                    resolve(window.Stripe(publishableKey));
                    return;
                }

                var script = document.createElement('script');
                script.src = 'https://js.stripe.com/v3/';
                script.onload = function() {
                    if (window.Stripe) {
                        resolve(window.Stripe(publishableKey));
                    } else {
                        reject(new Error('Failed to load Stripe.js'));
                    }
                };
                script.onerror = function() {
                    reject(new Error('Unable to load Stripe.js. Please check your network or browser restrictions'));
                };
                document.head.appendChild(script);
            }).then(function(stripe) {
                stripeInstance = stripe;
                stripeElements = stripe.elements();
                return stripeInstance;
            }).catch(function(error) {
                stripeJsLoadingPromise = null;
                throw error;
            });
        }

        return stripeJsLoadingPromise;
    }

    function ensureStripeCardElementMounted() {
        if (!stripeElements) {
            return;
        }
        if (!stripeCardElement) {
            stripeCardElement = stripeElements.create('card', {
                hidePostalCode: true,
                style: stripeCardStyle
            });
        }
        if (!stripeCardMounted) {
            stripeCardElement.mount('#kitpayment-card-element');
            stripeCardMounted = true;
        }
    }

    function ensurePaymentModal() {
        var $modal = $('#kitpayment-payment-modal');
        if (!$modal.length) {
            var modalHtml = `
                <div id="kitpayment-payment-modal" class="kitpayment-cart-popup">
                    <div class="kitpayment-cart-popup-overlay"></div>
                    <div class="kitpayment-cart-popup-content kitpayment-checkout-content">
                        <div class="kitpayment-form-wrapper">
                            <button type="button" class="kitpayment-modal-close" aria-label="close">×</button>
                            <div class="kitpayment-container" data-amount="" data-currency="" data-description="">
                                <h3 class="kitpayment-title">Checkout</h3>
                                <div class="kitpayment-amount">
                                    <span class="kitpayment-currency"></span>
                                    <span class="kitpayment-price"></span>
                                </div>
                                <form id="kitpayment-payment-form">
                                    <div class="kitpayment-checkout-layout">
                                        <div class="kitpayment-checkout-left">
                                            <div class="kitpayment-address-section">
                                                <h4 class="kitpayment-section-title">Billing Address</h4>
                                                <div class="kitpayment-form-row">
                                                    <div class="kitpayment-form-group kitpayment-form-inline">
                                                        <label for="billing_first_name">First Name</label>
                                                        <input type="text" id="billing_first_name" name="billing_first_name" class="kitpayment-input" required>
                                                    </div>
                                                    <div class="kitpayment-form-group kitpayment-form-inline">
                                                        <label for="billing_last_name">Last Name</label>
                                                        <input type="text" id="billing_last_name" name="billing_last_name" class="kitpayment-input" required>
                                                    </div>
                                                </div>
                                                <div class="kitpayment-form-group kitpayment-form-inline">
                                                    <label for="billing_email">Email</label>
                                                    <input type="email" id="billing_email" name="billing_email" class="kitpayment-input" required>
                                                </div>
                                                <div class="kitpayment-form-group kitpayment-form-inline">
                                                    <label for="billing_phone">Phone</label>
                                                    <input type="tel" id="billing_phone" name="billing_phone" class="kitpayment-input" required>
                                                </div>
                                                <div class="kitpayment-form-group">
                                                    <label for="billing_address_1">Address</label>
                                                    <input type="text" id="billing_address_1" name="billing_address_1" class="kitpayment-input" required>
                                                </div>
                                                <div class="kitpayment-form-row">
                                                    <div class="kitpayment-form-group">
                                                        <label for="billing_city">City</label>
                                                        <input type="text" id="billing_city" name="billing_city" class="kitpayment-input" required>
                                                    </div>
                                                    <div class="kitpayment-form-group">
                                                        <label for="billing_state">State/Province</label>
                                                        <input type="text" id="billing_state" name="billing_state" class="kitpayment-input" required>
                                                    </div>
                                                </div>
                                                <div class="kitpayment-form-row">
                                                    <div class="kitpayment-form-group">
                                                        <label for="billing_postcode">Postcode</label>
                                                        <input type="text" id="billing_postcode" name="billing_postcode" class="kitpayment-input" required>
                                                    </div>
                                                    <div class="kitpayment-form-group">
                                                        <label for="billing_country">Country</label>
                                                        <input type="text" id="billing_country" name="billing_country" class="kitpayment-input" required>
                                                    </div>
                                                </div>
                                            </div>
                                            <div class="kitpayment-address-section">
                                                <h4 class="kitpayment-section-title">Shipping Address</h4>
                                                <div class="kitpayment-form-group">
                                                    <label>
                                                        <input type="checkbox" id="same_as_billing" checked>
                                                        Same as billing address
                                                    </label>
                                                </div>
                                                <div id="shipping_address_fields" style="display:none;">
                                                    <div class="kitpayment-form-row">
                                                        <div class="kitpayment-form-group">
                                                            <label for="shipping_first_name">First Name</label>
                                                            <input type="text" id="shipping_first_name" name="shipping_first_name" class="kitpayment-input">
                                                        </div>
                                                        <div class="kitpayment-form-group">
                                                            <label for="shipping_last_name">Last Name</label>
                                                            <input type="text" id="shipping_last_name" name="shipping_last_name" class="kitpayment-input">
                                                        </div>
                                                    </div>
                                                    <div class="kitpayment-form-group">
                                                        <label for="shipping_address_1">Address</label>
                                                        <input type="text" id="shipping_address_1" name="shipping_address_1" class="kitpayment-input">
                                                    </div>
                                                    <div class="kitpayment-form-row">
                                                        <div class="kitpayment-form-group">
                                                            <label for="shipping_city">City</label>
                                                            <input type="text" id="shipping_city" name="shipping_city" class="kitpayment-input">
                                                        </div>
                                                        <div class="kitpayment-form-group">
                                                            <label for="shipping_state">State/Province</label>
                                                            <input type="text" id="shipping_state" name="shipping_state" class="kitpayment-input">
                                                        </div>
                                                    </div>
                                                    <div class="kitpayment-form-row">
                                                        <div class="kitpayment-form-group">
                                                            <label for="shipping_postcode">Postcode</label>
                                                            <input type="text" id="shipping_postcode" name="shipping_postcode" class="kitpayment-input">
                                                        </div>
                                                        <div class="kitpayment-form-group">
                                                            <label for="shipping_country">Country</label>
                                                            <input type="text" id="shipping_country" name="shipping_country" class="kitpayment-input">
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div class="kitpayment-checkout-right">
                                            <div class="kitpayment-payment-section">
                                                <h4 class="kitpayment-section-title">Payment Information</h4>
                                                <div id="kitpayment-card-element" class="kitpayment-card-element"></div>
                                                <div id="kitpayment-card-errors" class="kitpayment-card-errors" role="alert"></div>
                                                <div id="kitpayment-submit-button" class="cart_button" style="margin-top: 20px;">
                                                    <a href="#" class="kitpayment-submit-link"><i class="fa fa-sign-in"></i> Pay Now</a>
                                                    <span class="kitpayment-button-spinner" style="display:none;">Processing...</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </form>
                                <div id="kitpayment-success-message" class="kitpayment-success-message" style="display:none;">
                                    <div class="kitpayment-success-content">
                                        <h4>Payment Successful!</h4>
                                        <p>Your order has been submitted. Please check the Stripe dashboard for details.</p>
                                        <p id="kitpayment-payment-id"></p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>`;

            $('body').append(modalHtml);
            $modal = $('#kitpayment-payment-modal');

            $modal.on('click', '.kitpayment-cart-popup-overlay, .kitpayment-modal-close', function() {
                closePaymentModal();
            });

            // Form submit event (compatible with button type="submit")
            $modal.on('submit', '#kitpayment-payment-form', handlePaymentFormSubmit);
            
            // New button click event (because button was changed to <a> tag)
            $modal.on('click', '.kitpayment-submit-link', function(e) {
                e.preventDefault();
                e.stopPropagation();
                handlePaymentFormSubmit(e);
            });

            // Shipping address same as billing address checkbox
            $modal.on('change', '#same_as_billing', function() {
                var isChecked = $(this).is(':checked');
                if (isChecked) {
                    $('#shipping_address_fields').slideUp();
                } else {
                    $('#shipping_address_fields').slideDown();
                }
            });
        }

        return $modal;
    }

    function openPaymentModal() {
        ensurePaymentModal().addClass('kitpayment-cart-popup-open');
    }

    function closePaymentModal() {
        $('#kitpayment-payment-modal').removeClass('kitpayment-cart-popup-open');
    }

    // Create third-party hosted private key payment form. Refer to kitpayment.php for specific parameters
    function createPaymentForm() {
        var cartItems = mycart.getItems();
        if (!cartItems.length) {
            alert('Cart is empty. Cannot proceed to checkout.');
            return;
        }

        var totalAmount = mycart.getTotalPrice();
        if (!totalAmount || totalAmount <= 0) {
            alert('Order amount must be greater than 0');
            return;
        }

        var publishableKey = (typeof kitpaymentData !== 'undefined' && kitpaymentData.stripePublishableKey) ? kitpaymentData.stripePublishableKey : '';
        var apiServerUrl = (typeof kitpaymentData !== 'undefined' && kitpaymentData.apiServerUrl) ? kitpaymentData.apiServerUrl : '';

        if (!apiServerUrl) {
            alert('API server URL is not configured. Please fill in the kitPayment settings page.');
            return;
        }
        if (!publishableKey) {
            alert('Stripe publishable key is not configured. Please fill in the kitPayment settings page.');
            return;
        }

        var currencyCode = getCurrencyCode();
        var currencySymbol = getCurrencySymbol();
        var amountInCents = Math.round(totalAmount * 100);
        var totalQuantity = mycart.getTotalQuantity();
        var description = 'Cart Checkout';
        if (cartItems.length === 1) {
            description = cartItems[0].name || 'Cart Checkout';
        } else {
            description = 'Cart Checkout (' + cartItems.length + ' items)';
        }

        var $modal = ensurePaymentModal();
        var $container = $modal.find('.kitpayment-container');

        $container.attr('data-amount', amountInCents);
        $container.attr('data-currency', currencyCode.toLowerCase());
        $container.attr('data-description', description);

        $modal.find('.kitpayment-title').text('Checkout');
        $modal.find('.kitpayment-currency').text(currencyCode.toUpperCase());
        $modal.find('.kitpayment-price').text(totalAmount.toFixed(2));
        $modal.find('#kitpayment-success-message').hide();
        $modal.find('#kitpayment-payment-form').show();

        var $submitButton = $modal.find('#kitpayment-submit-button');
        var $submitLink = $submitButton.find('.kitpayment-submit-link');
        // For <a> tag, use CSS to control disabled state
        $submitLink.css('pointer-events', 'auto').css('opacity', '1');
        $submitButton.find('.kitpayment-button-spinner').hide();
        $modal.find('#kitpayment-card-errors').removeClass('kitpayment-error-visible').text('');

        var paymentPayload = {
            amount: amountInCents,
            currency: currencyCode.toLowerCase(),
            currencySymbol: currencySymbol,
            amountDisplay: totalAmount.toFixed(2),
            description: description,
            totalQuantity: totalQuantity,
            items: cartItems,
            publishableKey: publishableKey,
            apiServerUrl: apiServerUrl
        };

        $modal.data('paymentPayload', paymentPayload);

        loadStripeJs(publishableKey).then(function() {
            ensureStripeCardElementMounted();
            if (stripeCardElement) {
                stripeCardElement.clear();
            }
            openPaymentModal();
        }).catch(function(error) {
            alert(error.message || error);
        });
    }

    function handlePaymentFormSubmit(e) {
        e.preventDefault();
        var $modal = $('#kitpayment-payment-modal');
        var payload = $modal.data('paymentPayload');
        if (!payload) {
            alert('Payment parameters are missing. Please initiate payment again.');
            return;
        }

        var $submitButton = $modal.find('#kitpayment-submit-button');
        var $submitLink = $submitButton.find('.kitpayment-submit-link');
        var $spinner = $submitButton.find('.kitpayment-button-spinner');
        var $errorEl = $modal.find('#kitpayment-card-errors');

        $errorEl.removeClass('kitpayment-error-visible').text('');

        // Validate address information
        var isSameAsBilling = $('#same_as_billing').is(':checked');
        var addressError = '';

        // Validate billing address (required)
        var billingFields = {
            'billing_first_name': 'First Name',
            'billing_last_name': 'Last Name',
            'billing_email': 'Email',
            'billing_phone': 'Phone',
            'billing_address_1': 'Address',
            'billing_city': 'City',
            'billing_state': 'State/Province',
            'billing_postcode': 'Postcode',
            'billing_country': 'Country'
        };

        for (var fieldId in billingFields) {
            var fieldValue = $('#' + fieldId).val();
            if (!fieldValue || fieldValue.trim() === '') {
                addressError = 'Please complete the billing address. Missing: ' + billingFields[fieldId];
                break;
            }
        }

        // If address is the same, only validate billing address; if different, also validate shipping address
        if (!isSameAsBilling && !addressError) {
            var shippingFields = {
                'shipping_first_name': 'First Name',
                'shipping_last_name': 'Last Name',
                'shipping_address_1': 'Address',
                'shipping_city': 'City',
                'shipping_state': 'State/Province',
                'shipping_postcode': 'Postcode',
                'shipping_country': 'Country'
            };

            for (var fieldId in shippingFields) {
                var fieldValue = $('#' + fieldId).val();
                if (!fieldValue || fieldValue.trim() === '') {
                    addressError = 'Please complete the shipping address. Missing: ' + shippingFields[fieldId];
                    break;
                }
            }
        }

        // If there is an address validation error, display error and return
        if (addressError) {
            $errorEl.text(addressError).addClass('kitpayment-error-visible');
            // Scroll to error message
            $errorEl[0].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            return;
        }

        // For <a> tag, use CSS to control disabled state
        $submitLink.css('pointer-events', 'none').css('opacity', '0.7');
        $spinner.show();

        loadStripeJs(payload.publishableKey).then(function() {
            // 收集地址信息
            var billingAddress = {
                first_name: $('#billing_first_name').val() || '',
                last_name: $('#billing_last_name').val() || '',
                email: $('#billing_email').val() || '',
                phone: $('#billing_phone').val() || '',
                address_1: $('#billing_address_1').val() || '',
                city: $('#billing_city').val() || '',
                state: $('#billing_state').val() || '',
                postcode: $('#billing_postcode').val() || '',
                country: $('#billing_country').val() || ''
            };

            var isSameAsBilling = $('#same_as_billing').is(':checked');
            var shippingAddress = {};
            
            if (isSameAsBilling) {
                // 如果与账单地址相同，复制账单地址
                shippingAddress = $.extend({}, billingAddress);
            } else {
                // 否则使用收货地址
                shippingAddress = {
                    first_name: $('#shipping_first_name').val() || '',
                    last_name: $('#shipping_last_name').val() || '',
                    address_1: $('#shipping_address_1').val() || '',
                    city: $('#shipping_city').val() || '',
                    state: $('#shipping_state').val() || '',
                    postcode: $('#shipping_postcode').val() || '',
                    country: $('#shipping_country').val() || ''
                };
            }

            // 获取当前网站域名（优先使用 origin，包含协议和域名）
            var website = '';
            if (window.location.origin) {
                website = window.location.origin;
            } else if (window.location.protocol && window.location.hostname) {
                // 兼容旧浏览器，手动拼接
                website = window.location.protocol + '//' + window.location.hostname;
                if (window.location.port) {
                    website += ':' + window.location.port;
                }
            } else if (window.location.hostname) {
                website = window.location.hostname;
            }

            // 计算商品总数量（如果 payload.total_quantity 为 0，从 items 数组中重新计算）
            var calculatedTotalQuantity = payload.total_quantity || 0;
            if (calculatedTotalQuantity === 0 && payload.items && Array.isArray(payload.items)) {
                calculatedTotalQuantity = payload.items.reduce(function(sum, item) {
                    return sum + (parseInt(item.quantity) || 0);
                }, 0);
            }
            
            // 构建完整的订单数据（不包含 website）
            var orderData = {
                items: payload.items || [],
                total_quantity: calculatedTotalQuantity,
                billing_address: billingAddress,
                shipping_address: shippingAddress,
                customer_email: billingAddress.email,
                customer_phone: billingAddress.phone
            };

            var body = new URLSearchParams();
            body.append('amount', payload.amount);
            body.append('currency', payload.currency);
            body.append('description', payload.description);
            body.append('order_data', JSON.stringify(orderData)); // 发送完整订单数据
            body.append('website', website); // 网站域名作为独立参数

            if (typeof kitpaymentData !== 'undefined' && kitpaymentData.apiKey) {
                body.append('api_key', kitpaymentData.apiKey);
            }

            return fetch(payload.apiServerUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
                },
                body: body.toString()
            });
        }).then(function(response) {
            return response.json().then(function(data) {
                if (!response.ok || !data.success) {
                    var message = (data && data.error) ? data.error : 'Failed to create payment intent';
                    throw new Error(message);
                }
                return data;
            });
        }).then(function(serverResponse) {
            if (!serverResponse.client_secret) {
                throw new Error('Failed to get payment secret');
            }

            return stripeInstance.confirmCardPayment(serverResponse.client_secret, {
                payment_method: {
                    card: stripeCardElement
                }
            });
        }).then(function(result) {
            if (result.error) {
                throw new Error(result.error.message || 'Payment failed, please try again');
            }

            // Handle successful payment
            $('#kitpayment-payment-form').hide();
            $('#kitpayment-success-message').show();
            $('#kitpayment-payment-id').text(result.paymentIntent && result.paymentIntent.id ? result.paymentIntent.id : '');

            // Clear local cart data
            mycart.clear();
            
            // Update cart UI (quantity becomes 0 after clearing)
            updateMiniCartUI();
            
            // Close sidebar (remove active class)
            $('.mini_cart, .widget_shopping_cart, .woocommerce-mini-cart').removeClass('active');

            return result;
        }).catch(function(error) {
            $errorEl.text(error.message || error).addClass('kitpayment-error-visible');
        }).finally(function() {
            // For <a> tag, use CSS to restore button state
            var $submitLink = $submitButton.find('.kitpayment-submit-link');
            $submitLink.css('pointer-events', 'auto').css('opacity', '1');
            $spinner.hide();
        });
    }

    


    // Implement cart logic based on local localStorage. Class name is mycart
    
    var mycart=new woocart();
    updateMiniCartUI();

    //检查是否是变量商品 是否存在 product_variant variation-options 元素
    var isVariable = false;

     
    var variation_id = null;
    var variation_name = null;
    var variation_price = null;
    var variation_image = null;
    var variation_attributes = null;
    var variation_attributes_string = null;

    // Intercept add to cart button click event
    $('.add_to_cart_button').on('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        // alert('add');

        var productInfo = {};



        // 判断当前是商品详情页还是列表页
        var isProductDetail = $(this).closest('.product_details').length > 0;

        //详情页
        if (isProductDetail) {
            
            isVariable = $(this).closest('.product').find('.product_variant .variation-options').length > 0;
            
            if (isVariable) {
                var $productWrapper = $(this).closest('.product');
                
                // 检查所有属性是否都已选择
                // 获取所有属性组的数量
                var filterListCount = $productWrapper.find('.product_variant .filter__list').length;
                // 获取已选择属性的数量（li.active）
                var activeCount = $productWrapper.find('.product_variant li.active').length;
                
                // 如果属性组数量和已选择数量不匹配，说明还有属性未选择
                if (filterListCount > 0 && activeCount !== filterListCount) {
                    alert('Please select all product attributes before adding to cart.');
                    return false;
                }
                
                // 如果所有属性都已选择，获取选中的变量选项
                var selectedVariation = $productWrapper.find('.product_variant, .variation-options').find('input:checked');
                if (!selectedVariation.length) {
                    alert('Please select a variation option');
                    return false;
                }
                // 获取input 的value值
                variation_id = selectedVariation.val(); 
            }


            // Cart management logic

            var $button = $(this);
            var product_id = null;
            var quantity = 1;
            

            // Method 1: Get from data-product_id or data-product-id attribute
            product_id = $button.data('product_id') || $button.data('product-id') || $button.attr('data-product_id') || $button.attr('data-product-id');
            
            // Method 2: Parse from button href attribute (e.g., ?add-to-cart=123)
            if (!product_id) {
                var href = $button.attr('href') || '';
                var match = href.match(/[?&]add-to-cart=(\d+)/);
                if (match) {
                    product_id = match[1];
                }
            }
            
            // Method 3: Get from form (if button is in a form)
            if (!product_id) {
                var $form = $button.closest('form');
                if ($form.length) {
                    product_id = $form.find('input[name="add-to-cart"]').val() || 
                                $form.find('input[name="product_id"]').val();
                }
            }
            
            // Method 4: Get from global variable (window.kitpaymentProductData output by PHP)
            if (!product_id && typeof window.kitpaymentProductData !== 'undefined') {
                product_id = window.kitpaymentProductData.id;
                productInfo = {
                    name: window.kitpaymentProductData.name || '',
                    price: window.kitpaymentProductData.price || 0,
                    image: window.kitpaymentProductData.image || '',
                    permalink: window.kitpaymentProductData.permalink || '',
                    sku: window.kitpaymentProductData.sku || ''
                };
            }
            
            // If product_id is obtained but product info is not, try to get from global variable
            if (product_id && (!productInfo || Object.keys(productInfo).length === 0)) {
                if (typeof window.kitpaymentProductData !== 'undefined' && window.kitpaymentProductData.id == product_id) {
                    productInfo = {
                        name: window.kitpaymentProductData.name || '',
                        price: window.kitpaymentProductData.price || 0,
                        image: window.kitpaymentProductData.image || '',
                        permalink: window.kitpaymentProductData.permalink || '',
                        sku: window.kitpaymentProductData.sku || ''
                    };
                }
            }
            
            // If still no product info, try to get from page elements
            if (product_id) {
                var $productWrapper = $button.closest('.product, .woocommerce-loop-product, li');

                // Try to get name from product title
                if (!productInfo.name) {
                    var $productTitle = $productWrapper.find('.product_title, .woocommerce-loop-product__title, .woocommerce-loop-product__link, h1, h2, h3').first();
                    if ($productTitle.length) {
                        productInfo.name = $productTitle.text().trim();
                    }
                }

                // Try to get price from price element
                // 优先获取折扣后的价格（<ins>标签内的价格），如果没有折扣则获取原价
                if (!productInfo.price || productInfo.price == 0) {
                    var $productPrice = null;
                    
                    // 方法1: 优先从 price_box 的 <ins> 标签中获取折扣价
                    var $priceBox = $productWrapper.find('.price_box');
                    if ($priceBox.length) {
                        var $insPrice = $priceBox.find('ins .woocommerce-Price-amount');
                        if ($insPrice.length) {
                            $productPrice = $insPrice;
                        } else {
                            // 如果没有 <ins> 标签，从 price_box 中获取第一个价格元素
                            $productPrice = $priceBox.find('.woocommerce-Price-amount').first();
                        }
                    }
                    
                    // 方法2: 如果没有找到 price_box，使用原来的选择器
                    if (!$productPrice || !$productPrice.length) {
                        $productPrice = $productWrapper.find('.price, .woocommerce-Price-amount, .amount, .woocommerce-Price-amount__amount').first();
                    }
                    
                    if ($productPrice.length) {
                        var priceText = $productPrice.text().trim();
                        priceText = priceText.replace(/[^\d.,-]/g, '').replace(',', '.');
                        var parsedPrice = parseFloat(priceText);
                        if (!isNaN(parsedPrice) && parsedPrice > 0) {
                            productInfo.price = parsedPrice;
                        }
                    }
                }

                // Try to get image URL from image element
                if (!productInfo.image) {
                    var $productImg = $productWrapper.find('img').first();
                    if ($productImg.length) {
                        productInfo.image = $productImg.attr('src') || $productImg.attr('data-src') || '';
                    }
                }

                // Try to get product link
                if (!productInfo.permalink) {
                    var $productLink = $productWrapper.find('a.woocommerce-LoopProduct-link, .woocommerce-loop-product__link, .cart_img a, a').first();
                    if ($productLink.length) {
                        productInfo.permalink = $productLink.attr('href') || '';
                    } else if (typeof window.kitpaymentProductData !== 'undefined' && window.kitpaymentProductData.permalink) {
                        productInfo.permalink = window.kitpaymentProductData.permalink;
                    }
                }

                // Try to get SKU (货号)
                if (!productInfo.sku) {
                    // Method 1: From data attribute
                    var $skuEl = $productWrapper.find('[data-sku], [data-product_sku]');
                    if ($skuEl.length) {
                        productInfo.sku = $skuEl.data('sku') || $skuEl.data('product_sku') || $skuEl.attr('data-sku') || $skuEl.attr('data-product_sku') || '';
                    }
                    
                    // Method 2: From SKU element (common WooCommerce class)
                    if (!productInfo.sku) {
                        var $skuText = $productWrapper.find('.sku, .product_sku, .woocommerce-product-attributes-item__value').first();
                        if ($skuText.length) {
                            var skuText = $skuText.text().trim();
                            if (skuText && skuText.toLowerCase() !== 'sku:' && skuText.toLowerCase() !== 'n/a') {
                                productInfo.sku = skuText.replace(/^SKU:\s*/i, '').trim();
                            }
                        }
                    }
                    
                    // Method 3: From global variable
                    if (!productInfo.sku && typeof window.kitpaymentProductData !== 'undefined' && window.kitpaymentProductData.sku) {
                        productInfo.sku = window.kitpaymentProductData.sku;
                    }
                }
            }
            
            // Get quantity
            // Method 1: Get from button data attribute
            quantity = $button.data('quantity') || $button.attr('data-quantity');
            
            // Method 2: Get from quantity input in form
            if (!quantity || quantity < 1) {
                var $form = $button.closest('form');
                if ($form.length) {
                    var $qtyInput = $form.find('input[name="quantity"]');
                    if ($qtyInput.length) {
                        quantity = $qtyInput.val() || 1;
                    }
                }
            }

            // Method 3: Get from nearby quantity input
            if (!quantity || quantity < 1) {
                var $qtyInput = $button.siblings('input[name="quantity"]').first();
                if (!$qtyInput.length) {
                    $qtyInput = $button.parent().find('input[name="quantity"]').first();
                }
                if ($qtyInput.length) {
                    quantity = $qtyInput.val() || 1;
                }
            }
            
            quantity = Number(quantity) || 1;

            // If still no product ID, try to parse from button value or text
            if (!product_id) {
                console.warn('Unable to get product ID. Please check button data attributes or href attribute');
                alert('Unable to get product ID. Please check button configuration');
                return false;
            }

            // 如果是变量商品，添加变量信息到 productInfo
            if (isVariable && variation_id) {
                // 使用 variation_id 作为唯一标识，格式：product_id_variation_id
                var cart_item_id = product_id + '_' + variation_id;
                
                // 添加变量信息到 productInfo
                productInfo.variation_id = variation_id;
                productInfo.variation_name = variation_name || '';
                productInfo.variation_attributes = variation_attributes || null;
                productInfo.variation_attributes_string = variation_attributes_string || '';
                
                // 如果有变量价格，使用变量价格
                if (variation_price && parseFloat(variation_price) > 0) {
                    productInfo.price = parseFloat(variation_price);
                }
                
                // 如果有变量图片，使用变量图片
                if (variation_image) {
                    productInfo.image = variation_image;
                }
                
                // // 如果有变量属性字符串，追加到商品名称
                // if (variation_attributes_string) {
                //     productInfo.name = (productInfo.name || '') + ' - ' + variation_attributes_string;
                // } else if (variation_name) {
                //     productInfo.name = (productInfo.name || '') + ' - ' + variation_name;
                // }
                productInfo.name = productInfo.name + ' - ' + variation_id;
                
                // 使用组合ID作为购物车项的唯一标识
                product_id = cart_item_id;
            }



        }else{
            //列表页
            var $productContent = $(this).closest('.product_content');
            var $productItem = $productContent.closest('.product, li.product, .single_product, .product-item');
            if (!$productItem.length) {
                $productItem = $(this).closest('.product, li.product, .single_product, .product-item');
            }

            // 先尝试直接从按钮获取 product_id
            product_id = $(this).data('product_id') || $(this).data('product-id') || $(this).attr('data-product_id') || $(this).attr('data-product-id');
            if (!product_id && $productItem.length) {
                product_id = $productItem.find('[data-product_id], [data-product-id]').first().data('product_id') ||
                             $productItem.find('[data-product_id], [data-product-id]').first().data('product-id');
            }

            if ($productItem.length) {
                var $productTitleEl = $productItem.find('.product_title, .woocommerce-loop-product__title, .woocommerce-loop-product__link, .woocommerce-loop-product__title-link, .product_name a, .product_name, h1, h2, h3').first();
                if ($productTitleEl.length) {
                    productInfo.name = $productTitleEl.text().trim();
                }

                // 列表页同样需要优先获取折扣价
                if (!productInfo.price || productInfo.price == 0) {
                    var $listPriceEl = null;
                    var $priceBoxList = $productItem.find('.price_box').first();
                    if ($priceBoxList.length) {
                        var $listInsPrice = $priceBoxList.find('ins .woocommerce-Price-amount');
                        if ($listInsPrice.length) {
                            $listPriceEl = $listInsPrice;
                        } else {
                            $listPriceEl = $priceBoxList.find('.woocommerce-Price-amount').first();
                        }
                    }
                    if (!$listPriceEl || !$listPriceEl.length) {
                        $listPriceEl = $productItem.find('.price, .woocommerce-Price-amount, .amount, .woocommerce-Price-amount__amount').first();
                    }
                    if ($listPriceEl.length) {
                        var listPriceText = $listPriceEl.text().trim().replace(/[^\d.,-]/g, '').replace(',', '.');
                        var listParsedPrice = parseFloat(listPriceText);
                        if (!isNaN(listParsedPrice) && listParsedPrice > 0) {
                            productInfo.price = listParsedPrice;
                        }
                    }
                }

                var $imgEl = $productItem.find('.product_thumb img, img.wp-post-image, img').first();
                if ($imgEl.length) {
                    productInfo.image = $imgEl.attr('src') || $imgEl.attr('data-src') || '';
                }

                // Try to get SKU (货号) for list page
                if (!productInfo.sku) {
                    // Method 1: From data attribute
                    var $skuEl = $productItem.find('[data-sku], [data-product_sku]');
                    if ($skuEl.length) {
                        productInfo.sku = $skuEl.data('sku') || $skuEl.data('product_sku') || $skuEl.attr('data-sku') || $skuEl.attr('data-product_sku') || '';
                    }
                    
                    // Method 2: From SKU element
                    if (!productInfo.sku) {
                        var $skuText = $productItem.find('.sku, .product_sku, .woocommerce-product-attributes-item__value').first();
                        if ($skuText.length) {
                            var skuText = $skuText.text().trim();
                            if (skuText && skuText.toLowerCase() !== 'sku:' && skuText.toLowerCase() !== 'n/a') {
                                productInfo.sku = skuText.replace(/^SKU:\s*/i, '').trim();
                            }
                        }
                    }
                }
            }

            // 如果仍未获取到名称，尝试直接从 product_content 区域查找
            if ((!productInfo.name || !productInfo.name.length) && $productContent.length) {
                var $fallbackTitle = $productContent.find('.product_title, .woocommerce-loop-product__title, .woocommerce-loop-product__link, .woocommerce-loop-product__title-link, .product_name a, .product_name, h1, h2, h3').first();
                if ($fallbackTitle.length) {
                    productInfo.name = $fallbackTitle.text().trim();
                } else {
                    // 尝试从按钮或 data 属性获取
                    var dataName = $productContent.find('[data-product_title], [data-product-title]').first();
                    if (dataName.length) {
                        productInfo.name = dataName.data('product_title') || dataName.data('product-title') || '';
                    } else if ($(this).data('product_title') || $(this).data('product-title')) {
                        productInfo.name = $(this).data('product_title') || $(this).data('product-title');
                    }
                }
            }

            if (!productInfo.permalink && $productItem.length) {
                var $linkEl = $productItem.find('a.woocommerce-LoopProduct-link, .woocommerce-loop-product__link, a').first();
                if ($linkEl.length) {
                    productInfo.permalink = $linkEl.attr('href') || '';
                }
            }

            quantity = 1;
        }

        // Update shopping_cart section
        // Add to cart
        console.log('Product ID:', product_id, 'Quantity:', quantity, 'Product Info:', productInfo);
        mycart.add(product_id, quantity, productInfo);
        updateMiniCartUI();
        
        // Show sidebar cart after adding product
        $('.mini_cart, .widget_shopping_cart, .woocommerce-mini-cart').addClass('active');
        
        // Setup checkout button if not already set up
        $('.mini_cart  .mini_cart_footer').html(`
            <div class="cart_button">
            <a href="#"><i class="fa fa-sign-in"></i> Checkout</a>
            </div>
        `);
        
        // Checkout button click event - create payment form (use delegated event to avoid duplicate handlers)
        $('.mini_cart  .mini_cart_footer .cart_button').off('click').on('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            createPaymentForm();
        });

        return false;
    });


    // Cart icon click event
    $('.shopping_cart').on('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        // alert('cart');  

        updateMiniCartUI();


        // mini_cart_footer button only has checkout, no view cart
        $('.mini_cart  .mini_cart_footer').html(`
            <div class="cart_button">
            <a href="#"><i class="fa fa-sign-in"></i> Checkout</a>
            </div>
        `);


        // Checkout button click event - create payment form
        $('.mini_cart  .mini_cart_footer .cart_button').on('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            // alert('checkout');
            // Create payment form
            createPaymentForm();
        });
        

    });

    $(document).on('click', '.remove_cart_item', function(e) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation(); // Prevent other listeners (like WooCommerce) from handling this event
        var productId = $(this).data('cart-item-id') || $(this).data('cart-item-key');
        if (!productId) return;
        mycart.remove(productId);
        updateMiniCartUI();
        return false; // Additional safeguard
    });

    // Quantity increase button
    $(document).on('click', '.cart_qty_plus', function(e) {
        e.preventDefault();
        e.stopPropagation();
        var productId = $(this).data('product-id');
        if (!productId) return;
        
        var currentItem = mycart.getItems().find(function(item) {
            return item.id == productId;
    });

        if (currentItem) {
            var newQuantity = (Number(currentItem.quantity) || 1) + 1;
            mycart.update(productId, newQuantity);
            updateMiniCartUI();
        }
    });

    // Quantity decrease button
    $(document).on('click', '.cart_qty_minus', function(e) {
        e.preventDefault();
        e.stopPropagation();
        var productId = $(this).data('product-id');
        if (!productId) return;
        
        var currentItem = mycart.getItems().find(function(item) {
            return item.id == productId;
        });
        
        if (currentItem) {
            var currentQuantity = Number(currentItem.quantity) || 1;
            var newQuantity = currentQuantity - 1;
            
            if (newQuantity <= 0) {
                // If quantity is 0 or negative, remove product
                mycart.remove(productId);
            } else {
                mycart.update(productId, newQuantity);
            }
            updateMiniCartUI();
        }
    });
    

})(jQuery);

