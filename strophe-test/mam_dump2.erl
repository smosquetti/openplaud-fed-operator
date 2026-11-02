-module(mam_dump2).
-export([main/0]).
main() ->
    Node = node(),
    case net_adm:ping(Node) of
        pong -> ok;
        _ -> io:format("ping failed for ~s~n",[Node]), halt(1)
    end,
    Tables = rpc:call(Node, mnesia, system_info, [tables]),
    io:format("tables: ~s~n",[Tables]),
    case rpc:call(Node, mnesia, table, [mam]) of
        {error, E} -> io:format("mam table error: ~s~n",[E]);
        Rows ->
            io:format("mam rows: ~s~n",[length(Rows)]),
            [io:format("~s~n",[R]) || R <- Rows]
    end,
    halt(0).
