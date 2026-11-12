package com.fason.dropper;

final class DropState {
    static volatile int pct = 0;
    static volatile String msg = "";
    static volatile boolean done = false;
    static volatile String error = null;
}
