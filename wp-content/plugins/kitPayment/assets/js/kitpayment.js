
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

        let imgurl = $('.product_details .product_zoom_main_img .product_zoom_thumb img').attr('src');
        // Ensure product basic info fields exist
        productInfo = Object.assign({
            name: '',
            price: 0,
            image: imgurl, // Thumbnail URL
            permalink: ''
        }, productInfo || {});

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
            var image = getPlaceholderImage();//item.image ;
            var quantity = Number(item.quantity) || 1;
            var price = typeof item.price === 'number' ? item.price : parseFloat(item.price) || 0;
            var itemTotal = price * quantity;
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
            var body = new URLSearchParams();
            body.append('amount', payload.amount);
            body.append('currency', payload.currency);
            body.append('description', payload.description);

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

    // Intercept add to cart button click event
    $('.add_to_cart_button ').on('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        // alert('add');


        // Cart management logic

        var $button = $(this);
        var product_id = null;
        var quantity = 1;
        var productInfo = {};

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
                permalink: window.kitpaymentProductData.permalink || ''
            };
        }
        
        // If product_id is obtained but product info is not, try to get from global variable
        if (product_id && (!productInfo || Object.keys(productInfo).length === 0)) {
            if (typeof window.kitpaymentProductData !== 'undefined' && window.kitpaymentProductData.id == product_id) {
                productInfo = {
                    name: window.kitpaymentProductData.name || '',
                    price: window.kitpaymentProductData.price || 0,
                    image: window.kitpaymentProductData.image || '',
                    permalink: window.kitpaymentProductData.permalink || ''
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
            if (!productInfo.price || productInfo.price == 0) {
                var $productPrice = $productWrapper.find('.price, .woocommerce-Price-amount, .amount, .woocommerce-Price-amount__amount').first();
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

        // Validate variable product variations before adding to cart
        if (typeof window.kitpaymentProductData !== 'undefined' && 
            window.kitpaymentProductData.isVariable === true && 
            window.kitpaymentProductData.id == product_id) {
            
            var variationAttributes = window.kitpaymentProductData.variationAttributes || [];
            var $form = $button.closest('form');
            var missingAttributes = [];
            
            // Check each required variation attribute
            for (var i = 0; i < variationAttributes.length; i++) {
                var attr = variationAttributes[i];
                var attrSlug = attr.slug || '';
                var attrName = attr.name || attrSlug;
                
                if (!attrSlug) continue;
                
                // Try to find the variation selector (select or input)
                var $attrSelector = null;
                
                // Method 1: Find by name attribute (most common)
                if ($form.length) {
                    $attrSelector = $form.find('select[name="' + attrSlug + '"], input[name="' + attrSlug + '"]');
                }
                
                // Method 2: If not found in form, search in the product wrapper
                if (!$attrSelector || !$attrSelector.length) {
                    var $productWrapper = $button.closest('.product, .woocommerce-loop-product, .product-details, .summary');
                    $attrSelector = $productWrapper.find('select[name="' + attrSlug + '"], input[name="' + attrSlug + '"]');
                }
                
                // Method 3: Try to find by data attribute or class (for custom themes)
                if (!$attrSelector || !$attrSelector.length) {
                    var $productWrapper = $button.closest('.product, .woocommerce-loop-product, .product-details, .summary');
                    $attrSelector = $productWrapper.find('[data-attribute="' + attrSlug + '"], [data-attribute-name="' + attrSlug + '"]');
                }
                
                // Check if attribute is selected
                var isSelected = false;
                if ($attrSelector && $attrSelector.length) {
                    if ($attrSelector.is('select')) {
                        // For select dropdown
                        var selectedValue = $attrSelector.val();
                        isSelected = selectedValue && selectedValue !== '' && selectedValue !== '0';
                    } else if ($attrSelector.is('input[type="radio"]')) {
                        // For radio buttons - check if any radio with same name is checked
                        var radioName = $attrSelector.attr('name');
                        if (radioName) {
                            var $allRadios = $form.length ? $form.find('input[type="radio"][name="' + radioName + '"]') : 
                                                           $('input[type="radio"][name="' + radioName + '"]');
                            isSelected = $allRadios.filter(':checked').length > 0;
                        } else {
                            isSelected = $attrSelector.is(':checked');
                        }
                    } else if ($attrSelector.is('input[type="checkbox"]')) {
                        // For checkboxes
                        isSelected = $attrSelector.is(':checked');
                    } else {
                        // For other input types
                        var inputValue = $attrSelector.val();
                        isSelected = inputValue && inputValue !== '' && inputValue !== '0';
                    }
                } else {
                    // If selector not found, it might be a required attribute that hasn't been selected
                    // In this case, we should still require it to be selected
                    // But we'll try one more method: search in the entire document
                    var $globalSelector = $('select[name="' + attrSlug + '"], input[name="' + attrSlug + '"]');
                    if ($globalSelector && $globalSelector.length) {
                        if ($globalSelector.is('select')) {
                            var selectedValue = $globalSelector.val();
                            isSelected = selectedValue && selectedValue !== '' && selectedValue !== '0';
                        } else if ($globalSelector.is('input[type="radio"]')) {
                            var radioName = $globalSelector.attr('name');
                            if (radioName) {
                                var $allRadios = $('input[type="radio"][name="' + radioName + '"]');
                                isSelected = $allRadios.filter(':checked').length > 0;
                            }
                        } else {
                            var inputValue = $globalSelector.val();
                            isSelected = inputValue && inputValue !== '' && inputValue !== '0';
                        }
                    }
                }
                
                if (!isSelected) {
                    missingAttributes.push(attrName);
                }
            }
            
            // If there are missing attributes, show error and prevent adding to cart
            if (missingAttributes.length > 0) {
                var errorMessage = '请先选择以下选项：\n' + missingAttributes.join('、\n');
                // Try to show WooCommerce-style notice if available
                if (typeof wc_add_to_cart_params !== 'undefined' && wc_add_to_cart_params.i18n_view_cart) {
                    // Use alert as fallback
                    alert(errorMessage);
                } else {
                    alert(errorMessage);
                }
                return false;
            }
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

