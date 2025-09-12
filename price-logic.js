/**
 * Kintone 最新仕入価格取得カスタマイズ - 価格変動判定ロジック
 * 
 * 価格比較と変動区分の自動判定を行う
 */

const PriceLogic = {
    
    /**
     * 価格変動区分を判定する
     * @param {number} currentPrice - 今回価格
     * @param {number} pastPrice - 過去価格
     * @returns {string} 価格変動区分
     */
    determinePriceChangeCategory: function(currentPrice, pastPrice) {
        CONFIG.log('価格変動判定開始', {
            currentPrice: currentPrice,
            pastPrice: pastPrice
        });
        
        // 今回価格が未入力の場合
        if (!this.isValidPrice(currentPrice)) {
            CONFIG.log('今回価格未入力のため未入力に設定');
            return CONFIG.PRICE_CHANGE_OPTIONS.NOT_ENTERED;
        }
        
        // 過去価格が未入力の場合は未入力を返す
        if (!this.isValidPrice(pastPrice)) {
            CONFIG.log('過去価格未入力のため未入力に設定');
            return CONFIG.PRICE_CHANGE_OPTIONS.NOT_ENTERED;
        }
        
        const currentPriceNum = parseFloat(currentPrice);
        const pastPriceNum = parseFloat(pastPrice);
        
        // 価格比較
        if (currentPriceNum === pastPriceNum) {
            CONFIG.log('据え置きとして判定');
            return CONFIG.PRICE_CHANGE_OPTIONS.UNCHANGED;
        } else if (currentPriceNum > pastPriceNum) {
            CONFIG.log('値上がりとして判定');
            return CONFIG.PRICE_CHANGE_OPTIONS.INCREASED;
        } else {
            CONFIG.log('値下がりとして判定');
            return CONFIG.PRICE_CHANGE_OPTIONS.DECREASED;
        }
    },
    
    
    /**
     * 有効な価格かどうかを判定する
     * @param {*} price - 価格値
     * @returns {boolean} 有効な価格の場合true
     */
    isValidPrice: function(price) {
        if (price === null || price === undefined || price === '') {
            return false;
        }
        
        const numPrice = parseFloat(price);
        return !isNaN(numPrice) && numPrice >= 0;
    },
    
    /**
     * 過去レコードから最新の価格情報を抽出する
     * @param {Array} records - 過去レコード配列
     * @returns {Object} 最新価格情報
     */
    extractLatestPrices: function(records) {
        CONFIG.log('最新価格抽出開始', { recordCount: records.length });
        
        if (!records || records.length === 0) {
            CONFIG.log('過去レコードが見つかりません');
            return {
                latestPurchasePrice: null,
                latestSellingPrice: null,
                specialPriceCategory: null,
                foundRecord: null
            };
        }
        
        // 納品日でソート（最新順）
        records.sort((a, b) => {
            const dateA = new Date(a[CONFIG.FIELDS.DELIVERY_DATE]?.value || 0);
            const dateB = new Date(b[CONFIG.FIELDS.DELIVERY_DATE]?.value || 0);
            return dateB - dateA;
        });
        
        const latestRecord = records[0];
        
        const result = {
            latestPurchasePrice: latestRecord[CONFIG.FIELDS.CURRENT_PURCHASE_PRICE]?.value || null,
            latestSellingPrice: latestRecord[CONFIG.FIELDS.CURRENT_SELLING_PRICE]?.value || null,
            specialPriceCategory: latestRecord[CONFIG.FIELDS.SPECIAL_PRICE_CATEGORY]?.value || null,
            foundRecord: latestRecord
        };
        
        CONFIG.log('最新価格抽出完了', result);
        return result;
    },
    
    /**
     * 価格変動に基づく追加処理を実行する
     * @param {string} changeCategory - 価格変動区分
     * @param {Object} priceData - 価格データ
     * @returns {Object} 更新すべきフィールド値
     */
    getAdditionalUpdates: function(changeCategory, priceData) {
        const updates = {};
        
        // 据え置きまたは値下がりの場合、過去の最新売単価を今回売単価に自動入力
        if (changeCategory === CONFIG.PRICE_CHANGE_OPTIONS.UNCHANGED || 
            changeCategory === CONFIG.PRICE_CHANGE_OPTIONS.DECREASED) {
            if (priceData.latestSellingPrice && this.isValidPrice(priceData.latestSellingPrice)) {
                updates[CONFIG.FIELDS.CURRENT_SELLING_PRICE] = {
                    value: priceData.latestSellingPrice
                };
                CONFIG.log('据え置き/値下がりのため売単価を自動入力', priceData.latestSellingPrice);
            }
        }
        
        // 特価区分の同期
        if (priceData.specialPriceCategory) {
            updates[CONFIG.FIELDS.SPECIAL_PRICE_CATEGORY] = {
                value: priceData.specialPriceCategory
            };
            CONFIG.log('特価区分を同期', priceData.specialPriceCategory);
        }
        
        return updates;
    },
    
    /**
     * 検索クエリを構築する
     * @param {Object} currentRecord - 現在のレコード
     * @returns {string} 検索クエリ
     */
    buildSearchQuery: function(currentRecord) {
        const conditions = [];
        
        // 同一商品の定義に基づいて検索条件を構築
        // PRODUCT_MATCH_FIELDS は「フィールドコード」または CONFIG.FIELDS のキー名を受け付ける
        CONFIG.SEARCH.PRODUCT_MATCH_FIELDS.forEach(fieldKeyOrCode => {
            const fieldCode = (CONFIG.FIELDS && CONFIG.FIELDS[fieldKeyOrCode]) ? CONFIG.FIELDS[fieldKeyOrCode] : fieldKeyOrCode;
            const fieldObj = currentRecord[fieldCode];
            const fieldValue = fieldObj && typeof fieldObj === 'object' ? fieldObj.value : undefined;
            const text = (typeof fieldValue === 'string') ? fieldValue.trim() : fieldValue;
            if (text !== undefined && text !== null && String(text).trim() !== '') {
                const escapedValue = this.escapeQueryValue(String(text));
                // フィールドコードは引用しない（値のみダブルクォート）
                conditions.push(`${fieldCode} = "${escapedValue}"`);
            }
        });
        
        // 商品の検索条件がない場合は検索しない
        if (conditions.length === 0) {
            CONFIG.log('商品名が空のため検索をスキップ');
            return null;
        }
        
        // 期間での絞り込み（日付が有効な場合のみ）
        const searchDate = new Date();
        searchDate.setDate(searchDate.getDate() - CONFIG.SEARCH.SEARCH_DAYS_BACK);
        
        // 日付が有効かチェック
        if (!isNaN(searchDate.getTime())) {
            const dateString = searchDate.toISOString().split('T')[0];
            // 納品日が日付型想定のため YYYY-MM-DD を使用
            conditions.push(`${CONFIG.FIELDS.DELIVERY_DATE} >= "${dateString}"`);
        } else {
            CONFIG.log('日付計算でエラーが発生したため、日付条件をスキップ');
        }
        
        const query = conditions.join(' and ');
        
        // 最終的にクエリが空でないかチェック
        if (!query || query.trim() === '') {
            CONFIG.log('最終的なクエリが空のため検索をスキップ');
            return null;
        }
        
        CONFIG.log('検索クエリ構築完了', query);
        return query;
    },

    /**
     * フォールバック付きの検索クエリ配列を構築する（厳密→緩和）
     * @param {Object} currentRecord
     * @returns {string[]} クエリ配列（優先順）
     */
    buildSearchQueries: function(currentRecord) {
        // CONFIG.SEARCH.PRODUCT_MATCH_FIELDS をコードに解決し、値があるものだけ残す
        const codes = [];
        CONFIG.SEARCH.PRODUCT_MATCH_FIELDS.forEach(keyOrCode => {
            const code = (CONFIG.FIELDS && CONFIG.FIELDS[keyOrCode]) ? CONFIG.FIELDS[keyOrCode] : keyOrCode;
            const val = currentRecord[code] && currentRecord[code].value;
            if (val !== undefined && val !== null && String(val).trim() !== '') {
                codes.push(code);
            }
        });

        const productCode = CONFIG.FIELDS && CONFIG.FIELDS.PRODUCT_NAME;
        const hasProduct = productCode && codes.includes(productCode);
        const orderedCodes = hasProduct
            ? [productCode].concat(codes.filter(c => c !== productCode))
            : codes;

        // 日付条件
        const searchDate = new Date();
        searchDate.setDate(searchDate.getDate() - CONFIG.SEARCH.SEARCH_DAYS_BACK);
        const dateString = !isNaN(searchDate.getTime()) ? searchDate.toISOString().split('T')[0] : null;

        const make = (useCodes) => {
            const conds = [];
            useCodes.forEach(code => {
                const v = currentRecord[code] && currentRecord[code].value;
                if (v !== undefined && v !== null && String(v).trim() !== '') {
                    conds.push(`${code} = "${this.escapeQueryValue(String(v).trim())}"`);
                }
            });
            if (dateString) conds.push(`${CONFIG.FIELDS.DELIVERY_DATE} >= "${dateString}"`);
            return conds.length ? conds.join(' and ') : null;
        };

        const queries = [];
        // 1) 厳密（全条件）
        if (orderedCodes.length) {
            const q1 = make(orderedCodes);
            if (q1) queries.push(q1);
        }
        // 2) 商品名＋他1（順に）
        if (hasProduct && orderedCodes.length >= 2) {
            for (let i = 1; i < orderedCodes.length; i++) {
                const q = make([productCode, orderedCodes[i]]);
                if (q && !queries.includes(q)) queries.push(q);
            }
        }
        // 3) 商品名のみ
        if (hasProduct) {
            const qMin = make([productCode]);
            if (qMin && !queries.includes(qMin)) queries.push(qMin);
        }

        CONFIG.log('フォールバック付きクエリ構築', queries);
        return queries;
    },
    
    /**
     * クエリ値の特殊文字をエスケープする
     * @param {string} value - エスケープする値
     * @returns {string} エスケープされた値
     */
    escapeQueryValue: function(value) {
        if (!value) return '';
        
        // 文字列に変換
        const strValue = String(value);
        
        // ダブルクォートをエスケープ
        return strValue.replace(/"/g, '\\"');
    }
};
