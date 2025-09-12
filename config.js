/**
 * Kintone 最新仕入価格取得カスタマイズ - 設定ファイル
 * 
 * フィールドコードやアプリケーションIDなどの設定値を管理
 */

const CONFIG = {
    // アプリケーション設定
    APP_ID: null, // 実際のアプリIDに変更してください
    
    // フィールドコード設定（ブラケット記法対応）
    FIELDS: {
        // 現在の価格情報
        CURRENT_PURCHASE_PRICE: '今回仕入単価',      // 今回仕入単価
        CURRENT_SELLING_PRICE: '今回売単価',        // 今回売単価

        // 過去の最新価格情報
        PAST_LATEST_PURCHASE_PRICE: '過去最新仕入単価',  // 過去最新仕入単価
        PAST_LATEST_SELLING_PRICE: '過去最新売単価',     // 過去最新売単価

        // 価格変動区分
        PRICE_CHANGE_CATEGORY: '仕入価格変動区分',        // 仕入価格変動区分

        // 検索用/同定用フィールド
        STORE_NAME: '工事店名',         // 店舗名（顧客名相当）
        STORE_CODE: '現場コード',       // 現場コード
        PRODUCT_NAME: '商品名',         // 商品名
        PRODUCT_NO: '売上No',           // 売上No
        DELIVERY_DATE: '納品日',        // 納品日（DATE）

        // 特価区分フィールド
        SPECIAL_PRICE_CATEGORY: '特価区分',   // 特価区分

        // その他（参照・将来拡張用を含む）
        ORDER_PERSON: '発注担当者',           // 発注担当者
        PRODUCT_DETAIL: '商品詳細',           // 商品詳細
        CAPACITY: '容量',                     // 容量
        UNIT: '単位',                         // 単位
        SALES_AMOUNT: '売上金額',             // 売上金額
        SALES_QTY: '売上数',                  // 売上数
        GROSS_PROFIT: '粗利',                 // 粗利
        CUSTOMER_CODE: '取引先コード',        // 取引先コード
        SITE_NAME: '現場名',                  // 現場名
        UPDATED_AT: '更新日時',               // 更新日時
        CREATED_AT: '作成日時',               // 作成日時
        UPDATED_BY: '更新者',                 // 更新者
        CREATED_BY: '作成者',                 // 作成者
        RECORD_ID: 'レコード番号',            // レコード番号
        // 旧キー互換: 単価確定フラ -> 売単価確定フラグ
        PRODUCT_UNIT: '売単価確定フラグ',     // 互換用キー（名称は旧）
        SELLING_PRICE_FIXED_FLAG: '売単価確定フラグ' // 正式キー
    },
    
    // 価格変動区分の選択肢
    PRICE_CHANGE_OPTIONS: {
        UNCHANGED: '据え置き',
        INCREASED: '値上がり',
        DECREASED: '値下がり',
        NOT_ENTERED: '未入力'
    },
    
    // UI設定
    UI: {
        BUTTON_TEXT: '過去の最新単価を取得する',
        BUTTON_ID: 'getPastPriceButton',
        BUTTON_STYLE: {
            // ヘッダUIに合わせて高さと垂直位置を揃える
            margin: '0 0 0 12px',
            height: '36px',
            lineHeight: '36px',
            padding: '0 16px',
            boxSizing: 'border-box',
            display: 'inline-flex',
            alignItems: 'center',
            verticalAlign: 'middle',
            backgroundColor: '#3498db',
            color: '#ffffff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px'
        }
    },
    
    // 検索設定
    SEARCH: {
        // 検索結果の最大件数
        MAX_RECORDS: 100,
        
        // 検索対象期間（日数）
        SEARCH_DAYS_BACK: 365,
        
        // 検索の基準フィールド（納品日ベース）
        SORT_FIELD: '納品日',
        
        // 同一商品の定義フィールド
        // - 値は「CONFIG.FIELDS のキー名」(例: 'PRODUCT_NAME') か
        //   「フィールドコードそのもの」のどちらでも可
        //   過去検索の精度向上のため、商品名＋工事店名＋現場コードで同定
        PRODUCT_MATCH_FIELDS: ['PRODUCT_NAME', 'STORE_NAME', 'STORE_CODE']
    },
    
    // バッチ処理設定
    BATCH: {
        // バッチサイズ（一度に更新するレコード数）
        SIZE: 100,
        
        // バッチ間の待機時間（ミリ秒）
        WAIT_TIME: 200
    },
    
    // ログ設定
    DEBUG: {
        ENABLED: true,
        PREFIX: '[価格取得カスタマイズ]'
    }
};

// 設定の検証
CONFIG.validate = function() {
    if (!this.APP_ID) {
        console.warn(this.DEBUG.PREFIX + ' APP_IDが設定されていません');
        return false;
    }
    return true;
};

// デバッグ用ログ関数
CONFIG.log = function(message, data = null) {
    if (this.DEBUG.ENABLED) {
        console.log(this.DEBUG.PREFIX + ' ' + message, data || '');
    }
};

// エラーログ関数
CONFIG.error = function(message, error = null) {
    console.error(this.DEBUG.PREFIX + ' エラー: ' + message, error || '');
};
