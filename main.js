/**
 * Kintone 最新仕入価格取得カスタマイズ - メインファイル
 * 
 * ボタン配置、イベントハンドラー、API呼び出しを管理
 */

(function() {
    'use strict';
    
    // アプリID設定（実際の値に変更してください）
    CONFIG.APP_ID = kintone.app.getId();
    
    /**
     * 一覧画面表示時のイベントハンドラー
     */
    kintone.events.on('app.record.index.show', function(event) {
        CONFIG.log('一覧画面表示イベント発生');
        
        // 設定の検証
        if (!CONFIG.validate()) {
            CONFIG.error('設定が正しくありません');
            return event;
        }
        
        // ボタンを配置
        createPriceButton();
        
        return event;
    });
    
    /**
     * レコード詳細画面表示時のイベントハンドラー（個別処理用）
     */
    kintone.events.on('app.record.detail.show', function(event) {
        CONFIG.log('レコード詳細画面表示イベント発生');
        
        // 設定の検証
        if (!CONFIG.validate()) {
            CONFIG.error('設定が正しくありません');
            return event;
        }
        
        // 詳細画面でもボタンを配置
        createPriceButton();
        
        return event;
    });
    
    /**
     * 価格取得ボタンを作成・配置する
     */
    function createPriceButton() {
        CONFIG.log('価格取得ボタンを作成中');
        
        try {
            // 既存のボタンがあれば削除
            const existingButton = document.getElementById(CONFIG.UI.BUTTON_ID);
            if (existingButton) {
                existingButton.remove();
            }
            
            // ボタン要素を作成
            const button = document.createElement('button');
            button.id = CONFIG.UI.BUTTON_ID;
            button.textContent = CONFIG.UI.BUTTON_TEXT;
            
            // スタイルを適用
            Object.assign(button.style, CONFIG.UI.BUTTON_STYLE);
            
            // ホバー効果
            button.addEventListener('mouseenter', function() {
                this.style.backgroundColor = '#2980b9';
            });
            
            button.addEventListener('mouseleave', function() {
                this.style.backgroundColor = CONFIG.UI.BUTTON_STYLE.backgroundColor;
            });
            
            // クリックイベント
            button.addEventListener('click', handleButtonClick);
            
            // ボタンを配置（画面に応じて配置場所を決定）
            let headerSpace = null;
            
            // 一覧画面の場合
            try {
                headerSpace = kintone.app.getHeaderMenuSpaceElement();
            } catch (e) {
                // 詳細画面の場合
                try {
                    headerSpace = kintone.app.record.getHeaderMenuSpaceElement();
                } catch (e2) {
                    CONFIG.error('ボタン配置場所が見つかりません');
                    return;
                }
            }
            
            if (headerSpace) {
                headerSpace.appendChild(button);
                CONFIG.log('ボタンを正常に配置しました');
            } else {
                CONFIG.error('ボタン配置場所が見つかりません');
            }
            
        } catch (error) {
            CONFIG.error('ボタン作成中にエラーが発生', error);
        }
    }
    
    /**
     * ボタンクリック時の処理
     */
    function handleButtonClick() {
        CONFIG.log('価格取得ボタンがクリックされました');
        
        try {
            // ボタンを無効化
            const button = document.getElementById(CONFIG.UI.BUTTON_ID);
            if (button) {
                button.disabled = true;
                button.textContent = '取得中...';
            }
            
            // 現在の画面を判定して処理を分岐
            const currentUrl = window.location.href;
            
            if (currentUrl.includes('/show')) {
                // 詳細画面の場合
                handleDetailPageProcess();
            } else if (currentUrl.includes('/index')) {
                // 一覧画面の場合
                handleIndexPageProcess();
            } else {
                throw new Error('対応していない画面です');
            }
            
        } catch (error) {
            CONFIG.error('ボタンクリック処理中にエラーが発生', error);
            resetButton();
            showErrorMessage('処理中にエラーが発生しました: ' + error.message);
        }
    }
    
    /**
     * 詳細画面での処理
     */
    function handleDetailPageProcess() {
        CONFIG.log('詳細画面での価格取得処理開始');
        
        try {
            // 現在のレコード情報を取得
            const currentRecord = kintone.app.record.get();
            if (!currentRecord || !currentRecord.record) {
                throw new Error('現在のレコード情報を取得できません');
            }
            
            CONFIG.log('現在のレコード情報', currentRecord.record);
            
            // 過去データを検索・取得
            searchPastRecords(currentRecord.record);
            
        } catch (error) {
            CONFIG.error('詳細画面処理中にエラーが発生', error);
            resetButton();
            showErrorMessage('詳細画面処理中にエラーが発生しました: ' + error.message);
        }
    }
    
    /**
     * 一覧画面での処理
     */
    function handleIndexPageProcess() {
        CONFIG.log('一覧画面での価格取得処理開始');
        
        try {
            // 一覧画面では全レコードまたは選択されたレコードを処理
            // 現在は基本実装として通知のみ
            showInfoMessage('一覧画面での一括処理機能は開発中です。\\n個別レコードでの処理をお試しください。');
            resetButton();
            
        } catch (error) {
            CONFIG.error('一覧画面処理中にエラーが発生', error);
            resetButton();
            showErrorMessage('一覧画面処理中にエラーが発生しました: ' + error.message);
        }
    }
    
    /**
     * 過去レコードを検索・取得する
     * @param {Object} currentRecord - 現在のレコード
     */
    function searchPastRecords(currentRecord) {
        CONFIG.log('過去レコード検索開始');
        
        try {
            // 検索クエリを構築
            const query = PriceLogic.buildSearchQuery(currentRecord);
            
            if (!query) {
                throw new Error('検索クエリを構築できませんでした');
            }
            
            // 検索に必要なフィールドを指定
            const fields = [
                CONFIG.FIELDS.CURRENT_PURCHASE_PRICE,
                CONFIG.FIELDS.CURRENT_SELLING_PRICE,
                CONFIG.FIELDS.SPECIAL_PRICE_CATEGORY,
                CONFIG.FIELDS.DELIVERY_DATE,
                CONFIG.FIELDS.PRODUCT_NAME,
                CONFIG.FIELDS.STORE_NAME,
                CONFIG.FIELDS.STORE_CODE
            ];
            
            // kintone.api()を使用してレコードを取得
            kintone.api(kintone.api.url('/k/v1/records', true), 'GET', {
                app: CONFIG.APP_ID,
                query: query,
                fields: fields,
                totalCount: true
            }, function(response) {
                // 成功時の処理
                handleSearchSuccess(response, currentRecord);
            }, function(error) {
                // エラー時の処理
                handleSearchError(error);
            });
            
        } catch (error) {
            CONFIG.error('過去レコード検索中にエラーが発生', error);
            resetButton();
            showErrorMessage('検索処理中にエラーが発生しました: ' + error.message);
        }
    }
    
    /**
     * 検索成功時の処理
     * @param {Object} response - API応答
     * @param {Object} currentRecord - 現在のレコード
     */
    function handleSearchSuccess(response, currentRecord) {
        CONFIG.log('過去レコード検索成功', {
            totalCount: response.totalCount,
            recordCount: response.records.length
        });
        
        try {
            // 最新価格情報を抽出
            const priceData = PriceLogic.extractLatestPrices(response.records);
            
            if (!priceData.latestPurchasePrice && !priceData.latestSellingPrice) {
                showInfoMessage('過去の価格データが見つかりませんでした');
                resetButton();
                return;
            }
            
            // 価格変動区分を判定
            const currentPurchasePrice = currentRecord[CONFIG.FIELDS.CURRENT_PURCHASE_PRICE]?.value;
            
            const changeCategory = PriceLogic.determinePriceChangeCategory(
                currentPurchasePrice,
                priceData.latestPurchasePrice
            );
            
            // 追加更新処理
            const additionalUpdates = PriceLogic.getAdditionalUpdates(changeCategory, priceData);
            
            // レコードを更新
            updateRecord(priceData, changeCategory, additionalUpdates);
            
        } catch (error) {
            CONFIG.error('検索成功処理中にエラーが発生', error);
            resetButton();
            showErrorMessage('データ処理中にエラーが発生しました: ' + error.message);
        }
    }
    
    /**
     * 検索エラー時の処理
     * @param {Object} error - エラー情報
     */
    function handleSearchError(error) {
        CONFIG.error('過去レコード検索でエラーが発生', error);
        resetButton();
        
        let errorMessage = 'データ検索中にエラーが発生しました';
        if (error && error.message) {
            errorMessage += ': ' + error.message;
        }
        
        showErrorMessage(errorMessage);
    }
    
    /**
     * レコードを更新する
     * @param {Object} priceData - 価格データ
     * @param {string} changeCategory - 価格変動区分
     * @param {Object} additionalUpdates - 追加更新内容
     */
    function updateRecord(priceData, changeCategory, additionalUpdates = {}) {
        CONFIG.log('レコード更新開始');
        
        try {
            const currentRecord = kintone.app.record.get();
            const updatedRecord = { ...currentRecord };
            
            // 過去最新価格を設定
            if (priceData.latestPurchasePrice) {
                updatedRecord.record[CONFIG.FIELDS.PAST_LATEST_PURCHASE_PRICE] = {
                    value: priceData.latestPurchasePrice
                };
            }
            
            if (priceData.latestSellingPrice) {
                updatedRecord.record[CONFIG.FIELDS.PAST_LATEST_SELLING_PRICE] = {
                    value: priceData.latestSellingPrice
                };
            }
            
            // 価格変動区分を設定
            updatedRecord.record[CONFIG.FIELDS.PRICE_CHANGE_CATEGORY] = {
                value: changeCategory
            };
            
            // 追加更新内容を適用
            Object.keys(additionalUpdates).forEach(fieldCode => {
                updatedRecord.record[fieldCode] = additionalUpdates[fieldCode];
            });
            
            // レコードを更新
            kintone.app.record.set(updatedRecord);
            
            CONFIG.log('レコード更新完了');
            showSuccessMessage('価格情報を正常に取得・更新しました');
            
            // 値上がりの場合は行の色を変更
            if (changeCategory === CONFIG.PRICE_CHANGE_OPTIONS.INCREASED) {
                applyRowHighlight();
            }
            
        } catch (error) {
            CONFIG.error('レコード更新中にエラーが発生', error);
            showErrorMessage('レコード更新中にエラーが発生しました: ' + error.message);
        } finally {
            resetButton();
        }
    }
    
    /**
     * 値上がり時の行ハイライト
     */
    function applyRowHighlight() {
        try {
            // レコード行要素を取得して背景色を変更
            const recordElements = document.querySelectorAll('.record-content-container');
            recordElements.forEach(element => {
                element.style.backgroundColor = '#ffe6e6'; // 薄い赤色
            });
            
            CONFIG.log('値上がり時の行ハイライトを適用しました');
        } catch (error) {
            CONFIG.error('行ハイライト適用中にエラーが発生', error);
        }
    }
    
    /**
     * ボタンを初期状態に戻す
     */
    function resetButton() {
        const button = document.getElementById(CONFIG.UI.BUTTON_ID);
        if (button) {
            button.disabled = false;
            button.textContent = CONFIG.UI.BUTTON_TEXT;
        }
    }
    
    /**
     * 成功メッセージを表示
     * @param {string} message - メッセージ
     */
    function showSuccessMessage(message) {
        CONFIG.log('成功: ' + message);
        // Kintoneの標準アラート機能があれば使用
        if (window.alert) {
            alert('✓ ' + message);
        }
    }
    
    /**
     * 情報メッセージを表示
     * @param {string} message - メッセージ
     */
    function showInfoMessage(message) {
        CONFIG.log('情報: ' + message);
        if (window.alert) {
            alert('ℹ ' + message);
        }
    }
    
    /**
     * エラーメッセージを表示
     * @param {string} message - エラーメッセージ
     */
    function showErrorMessage(message) {
        CONFIG.error(message);
        if (window.alert) {
            alert('✗ ' + message);
        }
    }
    
    CONFIG.log('メインスクリプトが読み込まれました');
    
})();