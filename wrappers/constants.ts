export abstract class Op {
    static readonly jetton = {
        excesses: 0xd53276db,
        internal_transfer: 0x178d4519,
        transfer_notification: 0x7362d09c,
        transfer: 0xf8a7ea5,
        burn: 0x595f07bc,
        burn_notification: 0x7bdd97de,
    }
    static readonly bridge = {
        create_receipt: 0x71a12142,
        create_native_receipt: 0xb8b38761,
        pause: 0xd79a92ed,
        restart: 0xe7f92207,
        receipt_ok: 0xedb91281,
        send_bridge_info_to_oracle: 0x00000004,
        transmit: 0x00000003,
        resend: 0x00000009,
        lock: 0x878f9b0e,
        lock_native_token: 0xaec2aee7,
        resend_to_oracle: 0x1f55bd2e,
        release: 0x9e47031d,    
        add_jetton_whitelist: 0xaf15eec5,
        remove_jetton: 0x17d98538,
        set_bridge_pool: 0x80f5a0f9,
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
    static readonly bridge_event = {
        JETTON_ADDED: 0xe6be20d5,
        JETTON_REMOVED: 0xfc2f070b,
        NEW_RECEIPT: 0xfcaf1515,
        RESTARTED: 0xcd6f0669,
        PAUSED: 0xb649891d,
        CODE_UPGRADED: 0x38342daf,
        ADMIN_UPGRADED: 0x98712a5a,
        OWNER_UPGRADED: 0x1a31949f
    }

    static readonly bridge_pool = {
        lock: 0x878f9b0e,
        lock_native_token: 0xaec2aee7,
        release: 0x9e47031d,
        add_liquidity: 0x3ebe5431,
        add_native_token_liquidity: 0x539ec741,
        remove_liquidity: 0x14626b95,
        resend_to_oracle: 0x1f55bd2e,
        receipt_ok: 0xedb91281,
        provider_liquidity: 0x5e7e727c,
        create_swap: 0xa4321808,
        set_daily_limit_config: 0xd3420280,
        set_rate_limit_config: 0x227c7ee6,
        set_bridge_swap: 0xaf78c1e,
        set_bridge: 0xcd3d3a0e,
        set_jetton_wallet_address: 0x288b5223,
        init_code_upgrade: 0xdf1e233d,
        init_owner_upgrade: 0x67f347d2,
        init_admin_upgrade: 0x2fb94384,
        cancel_code_upgrade: 0x357ccc67,
        cancel_owner_upgrade: 0xeca79dd7,
        cancel_admin_upgrade: 0xa4ed9981,
        finalize_upgrades: 0x6378509f
    }
    static readonly bridge_pool_event = {
        LIMIT_CONSUMED: 0xb9ac7cea,
        DAILY_LIMIT_CHANGED: 0x40839634,
        RATE_LIMIT_CHANGED: 0xef662842,
        LOCKED: 0x1a2a0f17,
        RELEASED: 0x3d76fd5a,
        SWAP_CREATED: 0xfe8ddc6a,
        CODE_UPGRADED: 0x38342daf,
        ADMIN_UPGRADED: 0x98712a5a,
        OWNER_UPGRADED: 0x1a31949f
    }

    static readonly bridge_pool_liquidity_account = {
        provider_liquidity: 0x5e7e727c,
        remove_native_token_liquidity: 0xbbb48325,
        remove_liquidity: 0x14626b95,
        account_remove_liquidity: 0x7284d741
    }

    static readonly multisig = {
        new_order: 0xdbfd045,
        execute: 0xff6310de,
        execute_internal: 0xdbd70e57
    }

    static readonly order = {
        approve: 0x845dda8c,
        approve_rejected: 0x7c055e53,
        approved: 0x845dda8c,
        init: 0xc674e474
    }
    static readonly actions = {
        send_message: 0x5757d6f8,
        update_multisig_params: 0x1b7cbf7d,
    }
}

export abstract class Errors {
    static readonly multisig = {
        unauthorized_new_order : 1007,
        invalid_new_order : 1008,
        not_enough_ton : 100,
        unauthorized_execute : 101,
        singers_outdated : 102,
        invalid_dictionary_sequence: 103,
        expired: 111
    }
    static readonly order = {
        unauthorized_init : 104,
        already_approved : 107,
        already_inited : 105,
        unauthorized_sign : 106,
        expired: 111,
        unknown_op: 0xffff,
        already_executed: 112
    }
};
