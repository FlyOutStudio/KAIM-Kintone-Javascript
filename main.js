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
            
            // Kintoneの画面判定を改善
            if (currentUrl.includes('/show') || currentUrl.includes('/edit')) {
                // 詳細画面・編集画面の場合
                handleDetailPageProcess();
            } else {
                // その他の場合（一覧画面含む）は詳細画面の処理を試す
                // レコード情報が取得できない場合は一覧画面として処理
                try {
                    const testRecord = kintone.app.record.get();
                    if (testRecord && testRecord.record) {
                        // レコード情報が取得できる場合は詳細画面として処理
                        handleDetailPageProcess();
                    } else {
                        // レコード情報が取得できない場合は一覧画面として処理
                        handleIndexPageProcess();
                    }
                } catch (e) {
                    // kintone.app.record.get()でエラーが発生した場合は一覧画面
                    handleIndexPageProcess();
                }
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
            // ユーザーに確認
            if (!confirm('全レコードの価格情報を一括更新しますか？\\n\\n処理に時間がかかる場合があります。')) {
                resetButton();
                return;
            }
            
            // 一括処理開始
            processBulkUpdate();
            
        } catch (error) {
            CONFIG.error('一覧画面処理中にエラーが発生', error);
            resetButton();
            showErrorMessage('一覧画面処理中にエラーが発生しました: ' + error.message);
        }
    }
    
    /**
     * 一括更新処理
     */
    function processBulkUpdate() {
        CONFIG.log('一括更新処理開始');
        
        // プログレス表示を準備
        createProgressDisplay();
        
        // 全レコードを取得
        getAllRecords().then(records => {
            CONFIG.log('取得したレコード数', records.length);
            
            // デバッグ用：最初のレコードの構造を確認
            if (records.length > 0) {
                CONFIG.log('最初のレコードの構造', records[0]);
                CONFIG.log('$idの値', records[0].$id);
            }
            
            updateProgressDisplay(0, records.length, '処理を開始しています...');
            
            // レコードを順次処理
            processBulkRecords(records, 0);
            
        }).catch(error => {
            CONFIG.error('レコード取得でエラーが発生', error);
            hideProgressDisplay();
            resetButton();
            showErrorMessage('レコード取得でエラーが発生しました: ' + error.message);
        });
    }
    
    /**
     * 全レコードを取得
     */
    function getAllRecords() {
        return new Promise((resolve, reject) => {
            CONFIG.log('全レコード取得開始');
            
            const query = ''; // 全レコードを取得
            const fields = [
                CONFIG.FIELDS.CURRENT_PURCHASE_PRICE,
                CONFIG.FIELDS.CURRENT_SELLING_PRICE,
                CONFIG.FIELDS.SPECIAL_PRICE_CATEGORY,
                CONFIG.FIELDS.DELIVERY_DATE,
                CONFIG.FIELDS.PRODUCT_NAME,
                CONFIG.FIELDS.STORE_NAME,
                CONFIG.FIELDS.STORE_CODE,
                CONFIG.FIELDS.PAST_LATEST_PURCHASE_PRICE,
                CONFIG.FIELDS.PAST_LATEST_SELLING_PRICE,
                CONFIG.FIELDS.PRICE_CHANGE_CATEGORY
            ];
            
            kintone.api(kintone.api.url('/k/v1/records', true), 'GET', {
                app: CONFIG.APP_ID,
                query: query,
                fields: fields,
                totalCount: true
            }, function(response) {
                resolve(response.records);
            }, function(error) {
                reject(error);
            });
        });
    }
    
    /**
     * レコードを順次処理
     */
    function processBulkRecords(records, index) {
        if (index >= records.length) {
            // 全件処理完了
            CONFIG.log('一括処理完了');
            hideProgressDisplay();
            resetButton();
            showSuccessMessage(`一括処理が完了しました。${records.length}件のレコードを処理しました。`);
            return;
        }
        
        const currentRecord = records[index];
        const recordId = currentRecord.$id?.value || currentRecord.$id || index;
        
        CONFIG.log(`レコード処理開始: ID=${recordId} (${index + 1}/${records.length})`);
        updateProgressDisplay(index + 1, records.length, `レコード ${index + 1}/${records.length} を処理中...`);
        
        // 現在のレコードの過去データを検索
        const query = PriceLogic.buildSearchQuery(currentRecord);
        
        if (!query) {
            // 検索条件が構築できない場合はスキップ
            CONFIG.log(`レコード ${recordId} の検索条件が構築できないためスキップ`);
            setTimeout(() => processBulkRecords(records, index + 1), 100);
            return;
        }
        
        // 過去レコードを検索
        kintone.api(kintone.api.url('/k/v1/records', true), 'GET', {
            app: CONFIG.APP_ID,
            query: query + ` and $id != ${recordId}`, // 自分自身を除外
            fields: [
                CONFIG.FIELDS.CURRENT_PURCHASE_PRICE,
                CONFIG.FIELDS.CURRENT_SELLING_PRICE,
                CONFIG.FIELDS.SPECIAL_PRICE_CATEGORY,
                CONFIG.FIELDS.DELIVERY_DATE
            ]
        }, function(response) {
            // 成功時の処理
            processSingleRecord(currentRecord, response.records, index, records);
        }, function(error) {
            // エラー時の処理
            CONFIG.error(`レコード ${recordId} の検索でエラー`, error);
            // エラーが発生してもスキップして次に進む
            setTimeout(() => processBulkRecords(records, index + 1), 100);
        });
    }
    
    /**
     * 単一レコードの処理
     */
    function processSingleRecord(currentRecord, pastRecords, index, allRecords) {
        const recordId = currentRecord.$id?.value || currentRecord.$id || index;
        
        try {
            // 最新価格情報を抽出
            const priceData = PriceLogic.extractLatestPrices(pastRecords);
            
            if (!priceData.latestPurchasePrice && !priceData.latestSellingPrice) {
                CONFIG.log(`レコード ${recordId} の過去データが見つからないためスキップ`);
                setTimeout(() => processBulkRecords(allRecords, index + 1), 100);
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
            
            // 更新データを構築
            const updateData = {
                app: CONFIG.APP_ID,
                id: recordId,
                record: {}
            };
            
            // 過去最新価格を設定
            if (priceData.latestPurchasePrice) {
                updateData.record[CONFIG.FIELDS.PAST_LATEST_PURCHASE_PRICE] = {
                    value: priceData.latestPurchasePrice
                };
            }
            
            if (priceData.latestSellingPrice) {
                updateData.record[CONFIG.FIELDS.PAST_LATEST_SELLING_PRICE] = {
                    value: priceData.latestSellingPrice
                };
            }
            
            // 価格変動区分を設定
            updateData.record[CONFIG.FIELDS.PRICE_CHANGE_CATEGORY] = {
                value: changeCategory
            };
            
            // 追加更新内容を適用
            Object.keys(additionalUpdates).forEach(fieldCode => {
                updateData.record[fieldCode] = additionalUpdates[fieldCode];
            });
            
            // レコードを更新
            kintone.api(kintone.api.url('/k/v1/record', true), 'PUT', updateData, 
                function(response) {
                    CONFIG.log(`レコード ${recordId} の更新完了`);
                    // 次のレコードを処理（100ms待機してAPI制限を回避）
                    setTimeout(() => processBulkRecords(allRecords, index + 1), 100);
                },
                function(error) {
                    CONFIG.error(`レコード ${recordId} の更新でエラー`, error);
                    // エラーが発生してもスキップして次に進む
                    setTimeout(() => processBulkRecords(allRecords, index + 1), 100);
                }
            );
            
        } catch (error) {
            CONFIG.error(`レコード ${recordId} の処理中にエラー`, error);
            // エラーが発生してもスキップして次に進む
            setTimeout(() => processBulkRecords(allRecords, index + 1), 100);
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
    
    /**
     * 進捗表示を作成
     */
    function createProgressDisplay() {
        CONFIG.log('進捗表示を作成中');
        
        try {
            // 既存の進捗表示があれば削除
            const existingProgress = document.getElementById('priceUpdateProgress');
            if (existingProgress) {
                existingProgress.remove();
            }
            
            // 進捗表示コンテナを作成
            const progressContainer = document.createElement('div');
            progressContainer.id = 'priceUpdateProgress';
            progressContainer.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: white;
                border: 2px solid #3498db;
                border-radius: 8px;
                padding: 20px;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                z-index: 10000;
                min-width: 300px;
                text-align: center;
                font-family: Arial, sans-serif;
            `;
            
            // タイトル
            const title = document.createElement('h3');
            title.textContent = '価格情報一括更新中';
            title.style.cssText = 'margin: 0 0 15px 0; color: #333;';
            
            // プログレスバー
            const progressBar = document.createElement('div');
            progressBar.id = 'progressBar';
            progressBar.style.cssText = `
                width: 100%;
                height: 20px;
                background-color: #f0f0f0;
                border-radius: 10px;
                overflow: hidden;
                margin: 10px 0;
            `;
            
            const progressFill = document.createElement('div');
            progressFill.id = 'progressFill';
            progressFill.style.cssText = `
                height: 100%;
                background-color: #3498db;
                width: 0%;
                transition: width 0.3s ease;
            `;
            progressBar.appendChild(progressFill);
            
            // 進捗テキスト
            const progressText = document.createElement('div');
            progressText.id = 'progressText';
            progressText.textContent = '準備中...';
            progressText.style.cssText = 'margin: 10px 0; color: #666;';
            
            // パーセント表示
            const progressPercent = document.createElement('div');
            progressPercent.id = 'progressPercent';
            progressPercent.textContent = '0%';
            progressPercent.style.cssText = 'font-weight: bold; color: #3498db; font-size: 18px;';
            
            // キャンセルボタン
            const cancelButton = document.createElement('button');
            cancelButton.textContent = 'キャンセル';
            cancelButton.style.cssText = `
                margin-top: 15px;
                padding: 8px 16px;
                background-color: #e74c3c;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
            `;
            cancelButton.onclick = function() {
                if (confirm('処理を中断しますか？')) {
                    hideProgressDisplay();
                    resetButton();
                    showInfoMessage('処理が中断されました');
                }
            };
            
            // 要素を組み立て
            progressContainer.appendChild(title);
            progressContainer.appendChild(progressPercent);
            progressContainer.appendChild(progressBar);
            progressContainer.appendChild(progressText);
            progressContainer.appendChild(cancelButton);
            
            // ページに追加
            document.body.appendChild(progressContainer);
            
            CONFIG.log('進捗表示を作成しました');
            
        } catch (error) {
            CONFIG.error('進捗表示作成中にエラーが発生', error);
        }
    }
    
    /**
     * 進捗表示を更新
     * @param {number} current - 現在の処理数
     * @param {number} total - 総処理数
     * @param {string} message - 表示メッセージ
     */
    function updateProgressDisplay(current, total, message) {
        try {
            const progressFill = document.getElementById('progressFill');
            const progressText = document.getElementById('progressText');
            const progressPercent = document.getElementById('progressPercent');
            
            if (progressFill && progressText && progressPercent) {
                const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
                
                progressFill.style.width = percentage + '%';
                progressText.textContent = message || `${current}/${total} 件処理中...`;
                progressPercent.textContent = percentage + '%';
                
                CONFIG.log(`進捗更新: ${current}/${total} (${percentage}%)`);
            }
        } catch (error) {
            CONFIG.error('進捗表示更新中にエラーが発生', error);
        }
    }
    
    /**
     * 進捗表示を非表示
     */
    function hideProgressDisplay() {
        try {
            const progressContainer = document.getElementById('priceUpdateProgress');
            if (progressContainer) {
                progressContainer.remove();
                CONFIG.log('進捗表示を非表示にしました');
            }
        } catch (error) {
            CONFIG.error('進捗表示非表示中にエラーが発生', error);
        }
    }
    
    CONFIG.log('メインスクリプトが読み込まれました');
    
})();