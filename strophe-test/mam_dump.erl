%% Connect to ejabberd node and dump MAM records
-module(mam_dump).
-export([main/0]).
main() ->
    case net_adm:ping(node()) of
        pong -> ok;
        _ -> io:format("node not pingable: ~s~n",[node()]), halt(1)
    end,
    %% list tables
    Tbs = [T#{name} || T <- (mnesia:system_info(tables))],
    io:format("tables: ~s~n", [Tbs]),
    %% try mam table
    case mnesia:table_info(mam) of
        {error, _} -> io:format("no mam table~n");
        _ ->
            Rows = [R || R <- mnesia:table(mam)],
            io:format("mam rows: ~s~n",[length(Rows)])
    end,
    halt(0).
