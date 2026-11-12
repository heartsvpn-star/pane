package com.fason.dropper;

import android.app.Application;

public class App extends Application {
    @Override
    public void onCreate() {
        super.onCreate();
        DropState.pct = 0;
    }
}
