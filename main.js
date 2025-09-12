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
     * ステータスチップ（ヘッダ右上）
     */
    function ensureStatusChip() {
        const id = 'kaim-status-chip';
        let chip = document.getElementById(id);
        if (!chip) {
            chip = document.createElement('span');
            chip.id = id;
            chip.style.cssText = [
                'margin-left:8px',
                'padding:2px 8px',
                'border-radius:12px',
                'font-size:12px',
                'background:#eef3fb',
                'color:#2c5aa0',
                'vertical-align:middle'
            ].join(';');
            const header = kintone.app.getHeaderMenuSpaceElement && kintone.app.getHeaderMenuSpaceElement();
            if (header) header.appendChild(chip);
        }
        return chip;
    }

    function setStatus(text, type) {
        const palette = {
            info:  { bg: '#eef3fb', fg: '#2c5aa0' },
            success: { bg: '#e6f7eb', fg: '#1b6e3c' },
            error: { bg: '#fdecea', fg: '#8e2d22' }
        }[type || 'info'];
        const chip = ensureStatusChip();
        chip.textContent = text;
        chip.style.background = palette.bg;
        chip.style.color = palette.fg;
    }

    function clearStatus() {
        const chip = document.getElementById('kaim-status-chip');
        if (chip) chip.remove();
    }
    
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
    
    // 仕様書では一覧画面のみのため、詳細画面のイベントハンドラーは削除
    
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
            
            // ボタンを配置（一覧画面のヘッダー部分）
            let headerSpace = null;
            
            try {
                headerSpace = kintone.app.getHeaderMenuSpaceElement();
            } catch (e) {
                CONFIG.error('一覧画面のボタン配置場所が見つかりません');
                return;
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
            
            setStatus('処理中…', 'info');
            
            // 一覧画面での一括処理のみ実行
            handleIndexPageProcess();
            
        } catch (error) {
            CONFIG.error('ボタンクリック処理中にエラーが発生', error);
            resetButton();
            showErrorMessage('処理中にエラーが発生しました: ' + error.message);
        }
    }
    
    // 詳細画面での処理は仕様書にないため削除
    
    /**
     * 一覧画面での処理
     */
    function handleIndexPageProcess() {
        CONFIG.log('一覧画面での価格取得処理開始');
        
        try {
            // ユーザーに確認
            if (!confirm('全レコードの価格情報を一括更新しますか？処理に時間がかかる場合があります。')) {
                resetButton();
                return;
            }
            
            // 一括処理開始
            processBulkUpdate();
            
        } catch (error) {
            CONFIG.error('一覧画面処理中にエラーが発生', error);
            setStatus('エラー', 'error');
            resetButton();
            showErrorMessage('一覧画面処理中にエラーが発生しました: ' + error.message);
        }
    }
    
    /**
     * 一括更新処理（バッチ処理版）
     */
    function processBulkUpdate() {
        CONFIG.log('バッチ処理による一括更新開始');
        
        // ステータスチップで進捗状態を表示
        setStatus('処理中…', 'info');
        
        // 全レコードを取得
        getAllRecords().then(records => {
            CONFIG.log('取得したレコード数', records.length);
            
            if (records.length === 0) {
                setStatus('完了', 'success');
                resetButton();
                showInfoMessage('処理対象のレコードがありません');
                return;
            }
            
            // レコードをバッチ単位に分割
            const BATCH_SIZE = CONFIG.BATCH.SIZE;
            const batches = [];
            for (let i = 0; i < records.length; i += BATCH_SIZE) {
                batches.push(records.slice(i, i + BATCH_SIZE));
            }
            
            CONFIG.log(`${records.length}件のレコードを${batches.length}個のバッチに分割`);
            
            // バッチを順次処理
            processBatches(batches, 0, records.length);
            
        }).catch(error => {
            CONFIG.error('レコード取得でエラーが発生', error);
            setStatus('エラー', 'error');
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

            // 備考: fields を指定すると $id が返らない環境があるため fields は指定しない
            //      これにより $id と レコード番号 の両方が確実に取得できる
            kintone.api(kintone.api.url('/k/v1/records', true), 'GET', {
                app: CONFIG.APP_ID,
                query: query,
                totalCount: true
            }, function(response) {
                resolve(response.records);
            }, function(error) {
                reject(error);
            });
        });
    }
    
    /**
     * バッチを順次処理
     */
    function processBatches(batches, batchIndex, totalRecords) {
        if (batchIndex >= batches.length) {
            // 全バッチ処理完了
            CONFIG.log('バッチ処理完了');
            setStatus('完了', 'success');
            resetButton();
            showSuccessMessage(`バッチ処理が完了しました。${totalRecords}件のレコードを処理しました。\n\n※更新内容を確認するには、ページを再読み込み（F5キー）してください。`);
            return;
        }
        
        const currentBatch = batches[batchIndex];
        const processedCount = batchIndex * CONFIG.BATCH.SIZE;
        
        CONFIG.log(`バッチ ${batchIndex + 1}/${batches.length} 処理開始 (${currentBatch.length}件)`);
        setStatus('処理中…', 'info');
        
        // バッチ内の全レコードの過去データを並列で検索
        const searchPromises = currentBatch.map(record => searchPastDataForRecord(record));
        
        Promise.all(searchPromises).then(results => {
            // 更新データを準備
            const updateRecords = [];
            
            results.forEach((result, index) => {
                if (result && result.updateData) {
                    updateRecords.push(result.updateData);
                }
            });
            
            if (updateRecords.length === 0) {
                CONFIG.log(`バッチ ${batchIndex + 1} に更新対象レコードがありません`);
                setTimeout(() => processBatches(batches, batchIndex + 1, totalRecords), 100);
                return;
            }
            
            // バッチでレコード更新
            CONFIG.log(`バッチ ${batchIndex + 1}: ${updateRecords.length}件のレコードを一括更新`);
            
            kintone.api(kintone.api.url('/k/v1/records', true), 'PUT', {
                app: CONFIG.APP_ID,
                records: updateRecords
            }, function(response) {
                CONFIG.log(`バッチ ${batchIndex + 1} の更新完了`);
                // 次のバッチを処理（API制限回避のため少し待機）
                setTimeout(() => processBatches(batches, batchIndex + 1, totalRecords), CONFIG.BATCH.WAIT_TIME);
            }, function(error) {
                CONFIG.error(`バッチ ${batchIndex + 1} の更新でエラー`, error);
                setStatus('エラー', 'error');
                // エラーが発生しても次のバッチを処理
                setTimeout(() => processBatches(batches, batchIndex + 1, totalRecords), CONFIG.BATCH.WAIT_TIME);
            });
            
        }).catch(error => {
            CONFIG.error(`バッチ ${batchIndex + 1} の検索処理でエラー`, error);
            setStatus('エラー', 'error');
            // エラーが発生しても次のバッチを処理
            setTimeout(() => processBatches(batches, batchIndex + 1, totalRecords), CONFIG.BATCH.WAIT_TIME);
        });
    }
    
    /**
     * 単一レコードの過去データ検索
     */
    function searchPastDataForRecord(currentRecord) {
        return new Promise((resolve) => {
            // レコードIDの取得を改善
            let recordId = null;
            
            if (currentRecord.$id && currentRecord.$id.value) {
                recordId = currentRecord.$id.value;
            } else if (currentRecord.$id) {
                recordId = currentRecord.$id;
            } else if (currentRecord.レコード番号 && currentRecord.レコード番号.value) {
                recordId = currentRecord.レコード番号.value;
            } else if (currentRecord['$id']) {
                recordId = currentRecord['$id'];
            }
            
            CONFIG.log(`レコードID取得結果: ${recordId}`, currentRecord);
            
            // レコードIDが取得できない場合は自分自身除外なしで検索
            const skipSelfExclusion = !recordId;
            
            try {
                // フォールバック付きの検索クエリを構築
                const queries = (PriceLogic.buildSearchQueries && PriceLogic.buildSearchQueries(currentRecord))
                    || [PriceLogic.buildSearchQuery(currentRecord)].filter(Boolean);

                if (!queries || queries.length === 0) {
                    CONFIG.log(`レコード ${recordId || 'ID不明'} の検索条件が構築できないためスキップ`);
                    resolve(null);
                    return;
                }

                // 順次クエリを試す
                const tryQuery = (idx) => {
                    if (idx >= queries.length) {
                        resolve(null);
                        return;
                    }

                    const q = queries[idx];
                    if (!q || q.length > 2000) {
                        CONFIG.log(`レコード ${recordId || 'ID不明'} のクエリが無効/長すぎるため次へ`, q);
                        tryQuery(idx + 1);
                        return;
                    }

                    const finalQuery = skipSelfExclusion ? q : q + ` and $id != ${recordId}`;
                    CONFIG.log(`レコード ${recordId || 'ID不明'} の最終クエリ`, finalQuery);

                    kintone.api(kintone.api.url('/k/v1/records', true), 'GET', {
                        app: CONFIG.APP_ID,
                        query: finalQuery,
                        fields: [
                            CONFIG.FIELDS.CURRENT_PURCHASE_PRICE,
                            CONFIG.FIELDS.CURRENT_SELLING_PRICE,
                            CONFIG.FIELDS.SPECIAL_PRICE_CATEGORY,
                            CONFIG.FIELDS.DELIVERY_DATE
                        ]
                    }, function(response) {
                        if (response && response.records && response.records.length > 0) {
                            const result = processSingleRecordData(currentRecord, response.records);
                            resolve(result);
                        } else {
                            CONFIG.log(`レコード ${recordId || 'ID不明'}: クエリ${idx + 1}/${queries.length} で過去データ0件、次を試行`);
                            setTimeout(() => tryQuery(idx + 1), 50);
                        }
                    }, function(error) {
                        CONFIG.error(`レコード ${recordId || 'ID不明'} の検索でエラー`, error);
                        CONFIG.error(`エラーとなったクエリ: ${finalQuery}`);
                        if (error.errors && error.errors.query) {
                            CONFIG.error('詳細なクエリエラー:', error.errors.query);
                        }
                        setTimeout(() => tryQuery(idx + 1), 50);
                    });
                };

                tryQuery(0);

            } catch (error) {
                CONFIG.error(`レコード ${recordId} の処理中にエラー`, error);
                resolve(null);
            }
        });
    }
    
    /**
     * 単一レコードのデータ処理
     */
    function processSingleRecordData(currentRecord, pastRecords) {
        // レコードIDの取得を改善
        let recordId = null;
        
        if (currentRecord.$id && currentRecord.$id.value) {
            recordId = currentRecord.$id.value;
        } else if (currentRecord.$id) {
            recordId = currentRecord.$id;
        } else if (currentRecord.レコード番号 && currentRecord.レコード番号.value) {
            recordId = currentRecord.レコード番号.value;
        } else if (currentRecord['$id']) {
            recordId = currentRecord['$id'];
        }
        
        try {
            // 最新価格情報を抽出
            const priceData = PriceLogic.extractLatestPrices(pastRecords);
            
            if (!priceData.latestPurchasePrice && !priceData.latestSellingPrice) {
                CONFIG.log(`レコード ${recordId || 'ID不明'} の過去データが見つからないためスキップ`);
                return null;
            }
            
            // 価格変動区分を判定
            const currentPurchasePrice = currentRecord[CONFIG.FIELDS.CURRENT_PURCHASE_PRICE]?.value;
            const changeCategory = PriceLogic.determinePriceChangeCategory(
                currentPurchasePrice,
                priceData.latestPurchasePrice
            );
            
            // 追加更新処理
            const additionalUpdates = PriceLogic.getAdditionalUpdates(changeCategory, priceData);
            
            // レコードIDが取得できない場合は更新をスキップ
            if (!recordId) {
                CONFIG.log('レコードIDが取得できないため更新をスキップ');
                return null;
            }
            
            // 更新データを構築（id が無い場合はレコード番号を updateKey で使用）
            const updateData = {
                record: {}
            };

            if (recordId) {
                updateData.id = recordId;
            } else if (currentRecord['レコード番号'] && currentRecord['レコード番号'].value) {
                updateData.updateKey = {
                    field: 'レコード番号',
                    value: currentRecord['レコード番号'].value
                };
            } else {
                CONFIG.log('id もレコード番号も取得できないため更新対象から除外');
                return null;
            }
            
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
            
            CONFIG.log('更新データ作成', updateData);
            return { updateData: updateData };
            
        } catch (error) {
            CONFIG.error(`レコード ${recordId || 'ID不明'} のデータ処理中にエラー`, error);
            return null;
        }
    }
    
    // 詳細画面関連の関数は仕様書にないため削除
    
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
            title.textContent = 'バッチ処理による一括更新中';
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
