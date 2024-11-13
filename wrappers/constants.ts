export abstract class Op {
    static readonly bridge = {
        create_receipt: 0x71a12142,
        create_native_receipt: 0xb8b38761,
        pause: 0xd79a92ed,
        restart: 0xe7f92207,
        swap: 0x25938561,
        receipt_ok: 0xedb91281,
        send_bridge_info_to_oracle: 0x00000004,
        transmit: 0x00000003,
        resend: 0x00000009,
        lock: 0x878f9b0e,
        lock_native_token: 0xaec2aee7,
        resend_to_oracle: 0x1f55bd2e,
        add_jetton_whitelist: 0xaf15eec5,
        remove_jetton: 0x17d98538,
        set_bridge_pool: 0x80f5a0f9,
        set_bridge_swap: 0xaf78c1e,
        set_target_contract: 0xb759fa72,
        change_pause_controller: 0x257f64e2,
        change_oracle_address: 0xd831c6e6,
        init_code_upgrade: 0xdf1e233d,
        init_owner_upgrade: 0x67f347d2,
        init_admin_upgrade: 0x2fb94384,
        cancel_code_upgrade: 0x357ccc67,
        cancel_owner_upgrade: 0xeca79dd7,
        cancel_admin_upgrade: 0xa4ed9981,
        finalize_upgrades: 0x6378509f
    }
    static readonly bridge_swap = {
        swap: 0x25938561,
        release: 0x9e47031d,
        swap_failed: 0x54e8402,
        record_swap: 0xc02414b5,
        create_swap: 0xa4321808,
        resend_to_oracle: 0x1f55bd2e,
        release_native_token: 0xd0df706,
        init_code_upgrade: 0xdf1e233d,
        init_owner_upgrade: 0x67f347d2,
        init_admin_upgrade: 0x2fb94384,
        cancel_code_upgrade: 0x357ccc67,
        cancel_owner_upgrade: 0xeca79dd7,
        cancel_admin_upgrade: 0xa4ed9981,
        finalize_upgrades: 0x6378509f
    }
    static readonly bridge_pool = {
        lock: 0x878f9b0e,
        lock_native_token: 0xaec2aee7,
        release: 0x9e47031d,
        release_native_token: 0xd0df706,
        add_liquidity: 0x3ebe5431,
        add_native_token_liquidity: 0x539ec741,
        remove_liquidity: 0x14626b95,
        remove_native_token_liquidity: 0xbbb48325,
        record_receipt: 0xe446b638,
        swap_ok: 0xc64370e5,
        swap_failed: 0x54e8402,
        record_swap: 0xc02414b5,
        provider_liquidity: 0x5e7e727c,
        set_daily_limit_config: 0xd3420280,
        set_rate_limit_config: 0x227c7ee6,
        set_bridge_swap: 0xaf78c1e,
        set_bridge: 0xcd3d3a0e,
        init_code_upgrade: 0xdf1e233d,
        init_owner_upgrade: 0x67f347d2,
        init_admin_upgrade: 0x2fb94384,
        cancel_code_upgrade: 0x357ccc67,
        cancel_owner_upgrade: 0xeca79dd7,
        cancel_admin_upgrade: 0xa4ed9981,
        finalize_upgrades: 0x6378509f
    }

    static readonly bridge_receipt_account = {
        record_receipt: 0xe446b638,
        receipt_ok: 0xedb91281,
    }

    static readonly bridge_pool_liquidity_account = {
        provider_liquidity: 0x5e7e727c,
        remove_native_token_liquidity: 0xbbb48325,
        remove_liquidity: 0x14626b95,
        account_remove_liquidity: 0x7284d741
    }
}

export abstract class Errors {
    static readonly multisig = {
        unauthorized_new_order: 1007,
        invalid_new_order: 1008,
        not_enough_ton: 100,
        unauthorized_execute: 101,
        singers_outdated: 102,
        invalid_dictionary_sequence: 103,
        expired: 111
    }
    static readonly order = {
        unauthorized_init: 104,
        already_approved: 107,
        already_inited: 105,
        unauthorized_sign: 106,
        expired: 111,
        unknown_op: 0xffff,
        already_executed: 112
    }
};

export abstract class Params {
    static readonly bitsize = {
        op: 32,
        queryId: 64,
        orderSeqno: 256,
        signerIndex: 8,
        actionIndex: 8,
        time: 48
    }
}
